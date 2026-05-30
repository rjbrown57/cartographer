package generatecmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/rjbrown57/cartographer/pkg/log"

	"github.com/rjbrown57/cartographer/pkg/types/config"
	"github.com/rjbrown57/cartographer/pkg/utils"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var (
	num        int
	bodySize   int
	namespace  string
	namespaces string
	outputDir  string
	profile    string
	urlPercent int
)

type noteScenario struct {
	area     string
	kind     string
	resource string
	owner    string
	status   string
	tags     []string
}

var scenarios = []noteScenario{
	{area: "Platform", kind: "Incident handoff", resource: "checkout API latency", owner: "platform", status: "investigating", tags: []string{"incident", "platform", "api", "latency"}},
	{area: "Security", kind: "Access review", resource: "production break-glass group", owner: "security", status: "needs-review", tags: []string{"security", "access", "audit", "production"}},
	{area: "Operations", kind: "Runbook", resource: "database failover drill", owner: "sre", status: "ready", tags: []string{"runbook", "database", "failover", "sre"}},
	{area: "Product", kind: "Decision record", resource: "saved note search behavior", owner: "product", status: "accepted", tags: []string{"decision", "search", "notes", "product"}},
	{area: "Release", kind: "Launch checklist", resource: "regional rollout", owner: "release", status: "blocked", tags: []string{"release", "checklist", "rollout", "blocked"}},
	{area: "Support", kind: "Customer context", resource: "enterprise onboarding", owner: "support", status: "watching", tags: []string{"support", "customer", "onboarding", "enterprise"}},
	{area: "Research", kind: "Research note", resource: "markdown-heavy card rendering", owner: "design", status: "draft", tags: []string{"research", "markdown", "ui", "design"}},
	{area: "Infrastructure", kind: "Capacity note", resource: "search index memory growth", owner: "infra", status: "monitoring", tags: []string{"infrastructure", "capacity", "search", "memory"}},
}

// rootCmd represents the base command when called without any subcommands
var GenerateCmd = &cobra.Command{
	Use:   "generate",
	Short: "generate a fake ingestion config to test with cartographer server",
	Long:  `generate urls to test with cartographer server`,
	Run: func(cmd *cobra.Command, args []string) {

		// Configure logging to info level for all generate commands
		// This is to avoid the log messages from the generate command from being printed to the console
		log.ConfigureLog(false, 0)

		selectedNamespaces := getSelectedNamespaces()
		if outputDir != "" {
			writeGeneratedNamespaceFiles(selectedNamespaces)
			return
		}

		if len(selectedNamespaces) > 1 {
			log.Fatalf("--output-dir is required when generating more than one namespace")
		}

		o, err := yaml.Marshal(buildGeneratedConfig(selectedNamespaces[0]))
		if err != nil {
			log.Fatalf("Unable to marshal generated notes %s", err)
		}

		fmt.Printf("%s", o)
	},
}

// getSelectedNamespaces returns the namespaces requested for generation.
func getSelectedNamespaces() []string {
	rawNamespaces := namespace
	if namespaces != "" {
		rawNamespaces = namespaces
	}

	selectedNamespaces := make([]string, 0)
	seen := make(map[string]bool)
	for ns := range strings.SplitSeq(rawNamespaces, ",") {
		trimmed := strings.TrimSpace(ns)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		selectedNamespaces = append(selectedNamespaces, trimmed)
		seen[trimmed] = true
	}

	if len(selectedNamespaces) == 0 {
		return []string{"default"}
	}
	return selectedNamespaces
}

// writeGeneratedNamespaceFiles writes one generated YAML file per namespace.
func writeGeneratedNamespaceFiles(selectedNamespaces []string) {
	cleanOutputDir := filepath.Clean(outputDir)
	if cleanOutputDir == "." || cleanOutputDir == string(os.PathSeparator) {
		log.Fatalf("refusing to write generated namespace data to %q", outputDir)
	}

	if err := os.RemoveAll(cleanOutputDir); err != nil {
		log.Fatalf("Unable to clean output directory %s: %s", cleanOutputDir, err)
	}
	if err := os.MkdirAll(cleanOutputDir, 0o755); err != nil {
		log.Fatalf("Unable to create output directory %s: %s", cleanOutputDir, err)
	}

	for _, ns := range selectedNamespaces {
		out, err := yaml.Marshal(buildGeneratedConfig(ns))
		if err != nil {
			log.Fatalf("Unable to marshal generated notes for namespace %s: %s", ns, err)
		}

		path := filepath.Join(cleanOutputDir, fmt.Sprintf("%s.yaml", namespaceSlug(ns)))
		if err := os.WriteFile(path, out, 0o644); err != nil {
			log.Fatalf("Unable to write generated notes to %s: %s", path, err)
		}
	}
}

// buildGeneratedConfig builds an ingest config for a single namespace.
func buildGeneratedConfig(ns string) config.IngestConfig {
	genNotes := make([]*config.YamlNote, 0, num)
	for i := 0; i < num; i++ {
		genNotes = append(genNotes, buildGeneratedNote(i, ns))
	}

	return config.IngestConfig{
		Namespace: ns,
		Notes:     genNotes,
	}
}

// buildGeneratedNote creates a note-shaped test record with markdown-heavy content.
func buildGeneratedNote(index int, ns string) *config.YamlNote {
	scenario := scenarios[index%len(scenarios)]
	title := fmt.Sprintf("%s %04d: %s", scenario.kind, index+1, scenario.resource)
	nsSlug := namespaceSlug(ns)
	id := fmt.Sprintf("generated-%s-note-%06d", nsSlug, index+1)
	targetSize := targetBodySize(index)
	url := ""
	if urlPercent > 0 && index%100 < urlPercent {
		url = generatedURL(index, nsSlug, scenario)
	}

	return &config.YamlNote{
		Id:    id,
		Title: title,
		Body:  generateMarkdownBody(index, scenario, targetSize),
		URL:   url,
		Tags:  generatedTags(index, ns, scenario),
		Data:  generatedData(index, ns, scenario, targetSize),
	}
}

// targetBodySize resolves the markdown body size for the selected generator profile.
func targetBodySize(index int) int {
	size := bodySize
	if size <= 0 {
		switch profile {
		case "brief":
			size = 320
		case "long":
			size = 4000
		case "stress":
			size = 2500
		default:
			size = 900
		}
	}

	switch profile {
	case "stress":
		if index%12 == 0 {
			size = size * 6
		} else if index%5 == 0 {
			size = size * 2
		}
	default:
		if index%20 == 0 {
			size = size * 3
		} else if index%7 == 0 {
			size = maxPositive(size/2, 280)
		}
	}
	return maxPositive(size, 160)
}

// generateMarkdownBody builds markdown that exercises headings, lists, code, and long text.
func generateMarkdownBody(index int, scenario noteScenario, targetSize int) string {
	var body strings.Builder
	fmt.Fprintf(&body, "## %s\n\n", scenario.area)
	fmt.Fprintf(&body, "**Status:** `%s`  \n", scenario.status)
	fmt.Fprintf(&body, "**Owner:** @%s-team  \n", scenario.owner)
	fmt.Fprintf(&body, "**Generated case:** `%06d`\n\n", index+1)
	fmt.Fprintf(&body, "### Context\n\n")
	fmt.Fprintf(&body, "This note captures working context for **%s**. It is generated to exercise Cartographer card previews, expanded markdown rendering, search indexing, and tag filtering with note-like text instead of URL-only records.\n\n", scenario.resource)
	fmt.Fprintf(&body, "### Current read\n\n")
	fmt.Fprintf(&body, "- Signal quality is `%s` with a rotating owner.\n", scenario.status)
	fmt.Fprintf(&body, "- The expected next action is visible in the first card preview.\n")
	fmt.Fprintf(&body, "- Tags intentionally overlap with nearby notes so search has realistic density.\n\n")
	fmt.Fprintf(&body, "```text\ncartographer note=%06d owner=%s status=%s\n```\n\n", index+1, scenario.owner, scenario.status)

	paragraphs := []string{
		"The important detail is not the raw volume alone, but whether a person can scan the first screen, open the right record, and keep orientation while the page is carrying a large namespace.",
		"Repeated prose gives the renderer enough material to test truncation, markdown spacing, search highlighting behavior, and browser memory pressure without relying on random characters.",
		"Operational notes often mix headings, compact bullets, inline code, and links. The generated shape should make regressions in any of those surfaces obvious during local testing.",
		"Large notes should still be exceptional. Most submissions should stay compact enough that search results remain fast and expanded rendering feels immediate.",
	}

	for body.Len() < targetSize {
		section := (body.Len() / 700) + 1
		fmt.Fprintf(&body, "### Detail pass %d\n\n", section)
		for _, paragraph := range paragraphs {
			fmt.Fprintf(&body, "%s\n\n", paragraph)
			if body.Len() >= targetSize {
				break
			}
		}
	}

	return body.String()
}

// generatedTags returns scenario tags plus generated dimensions for filtering.
func generatedTags(index int, ns string, scenario noteScenario) []string {
	tags := append([]string{}, scenario.tags...)
	tags = append(tags,
		fmt.Sprintf("namespace:%s", ns),
		fmt.Sprintf("owner:%s", scenario.owner),
		fmt.Sprintf("status:%s", scenario.status),
		fmt.Sprintf("bucket:%02d", index%20),
	)
	if index%10 == 0 {
		tags = append(tags, "large-note")
	}
	if index%25 == 0 {
		tags = append(tags, "markdown-heavy")
	}
	return tags
}

// generatedData returns structured metadata to exercise data rendering and indexing.
func generatedData(index int, ns string, scenario noteScenario, targetSize int) map[string]any {
	data := utils.GenerateFakeData()
	data["namespace"] = ns
	data["owner"] = scenario.owner
	data["status"] = scenario.status
	data["profile"] = profile
	data["targetBodySize"] = targetSize
	data["sequence"] = index + 1
	return data
}

// generatedURL returns a deterministic URL for URL-bearing generated notes.
func generatedURL(index int, nsSlug string, scenario noteScenario) string {
	slug := strings.ReplaceAll(strings.ToLower(scenario.resource), " ", "-")
	return fmt.Sprintf("https://notes.example.internal/%s/%s/%s/%06d", nsSlug, scenario.owner, slug, index+1)
}

// namespaceSlug normalizes a namespace for generated ids and filenames.
func namespaceSlug(ns string) string {
	slug := strings.ToLower(strings.TrimSpace(ns))
	replacer := strings.NewReplacer("/", "-", "\\", "-", " ", "-", ":", "-", ".", "-")
	slug = replacer.Replace(slug)
	slug = strings.Trim(slug, "-")
	if slug == "" {
		return "default"
	}
	return slug
}

// maxPositive returns the larger positive value, falling back when value is unset.
func maxPositive(value int, fallback int) int {
	if value <= 0 {
		return fallback
	}
	if value > fallback {
		return value
	}
	return fallback
}

func init() {
	GenerateCmd.Flags().IntVarP(&num, "num", "n", 1, "number of notes to generate")
	GenerateCmd.Flags().IntVar(&bodySize, "body-size", 0, "target markdown body size per generated note")
	GenerateCmd.Flags().StringVar(&namespace, "namespace", "default", "namespace to write into the generated config")
	GenerateCmd.Flags().StringVar(&namespaces, "namespaces", "", "comma-separated namespaces to generate")
	GenerateCmd.Flags().StringVar(&outputDir, "output-dir", "", "directory to write one generated config per namespace")
	GenerateCmd.Flags().StringVar(&profile, "profile", "mixed", "content profile: brief, mixed, long, or stress")
	GenerateCmd.Flags().IntVar(&urlPercent, "url-percent", 55, "percentage of generated notes that include a URL")
	err := GenerateCmd.MarkFlagRequired("num")
	if err != nil {
		log.Fatalf("%s", err)
	}
}
