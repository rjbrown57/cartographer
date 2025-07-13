package utils

import (
	"fmt"
	"os"
	"reflect"
	"testing"

	"golang.org/x/exp/rand"
)

var TestFullConfig string = `
apiVersion: v1beta
cartographer:
  address: 0.0.0.0
  port: 8080
  web:
    address: 0.0.0.0
    port: 8081
    siteName: cartographer
groups:
  - name: example
    tags: ["tools","k8s"]
links: 
  - url: https://github.com/kubernetes/kubernetes
    tags: ["k8s"]
    description: |-
      kubernetes core github repository
    displayname: github kube
  - url: https://github.com/goharbor/harbor
    tags: ["oci", "k8s"]
  - data:
    example: "data"
`

var LinkOnly1Config string = `
  - url: https://github.com/rjbrown57/cartographer
    tags: ["k8s"]
    description: |-
      description
    displayname: cartographer 
`

var LinkOnly2Config string = `
  - url: https://github.com/rjbrown57/binman
    tags: ["k8s"]
    description: |-
      binman repository
    displayname: binman
`

func GetTestFile() (*os.File, error) {
	f, err := os.CreateTemp("", "*test.yaml")
	if err != nil {
		return nil, err
	}

	return f, nil
}

func WriteTestConfig() (*os.File, error) {
	f, err := GetTestFile()
	if err != nil {
		return nil, err
	}

	_, err = f.Write([]byte(TestFullConfig))
	if err != nil {
		return nil, err
	}

	return f, nil
}

func WriteTestDir() (string, error) {
	rootDir, err := os.MkdirTemp("", "*test")
	if err != nil {
		return "", err
	}

	// Write TestFullConfig at the root
	rootFile, err := os.CreateTemp(rootDir, "*.yaml")
	if err != nil {
		return "", err
	}
	_, err = rootFile.Write([]byte(TestFullConfig))
	if err != nil {
		return "", err
	}

	// Create first subdirectory and write LinkOnly1Config
	subDir1, err := os.MkdirTemp(rootDir, "*subdir1")
	if err != nil {
		return "", err
	}
	subFile1, err := os.CreateTemp(subDir1, "*.yaml")
	if err != nil {
		return "", err
	}
	_, err = subFile1.Write([]byte(fmt.Sprintf("links:\n%s", LinkOnly1Config)))
	if err != nil {
		return "", err
	}

	// Create second subdirectory and write LinkOnly2Config
	subDir2, err := os.MkdirTemp(rootDir, "*subdir2")
	if err != nil {
		return "", err
	}
	subFile2, err := os.CreateTemp(subDir2, "*.yaml")
	if err != nil {
		return "", err
	}
	_, err = subFile2.Write([]byte(fmt.Sprintf("links:\n%s", LinkOnly2Config)))
	if err != nil {
		return "", err
	}

	return rootDir, nil
}

func AssertDeepEqual(t *testing.T, got, expected interface{}) {
	if !reflect.DeepEqual(got, expected) {
		t.Fatalf("%+v\n is not equal to control %+v\n", got, expected)
	}
}

// Define a slice of possible top-level domains (TLDs)
var tlds = []string{".com", ".org", ".net", ".edu", ".gov", ".io", ".co", ".info", ".me"}

// Function to generate a random string of a given length
func GenerateRandomString(length int) string {
	letters := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
	b := make([]rune, length)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

// Function to generate a fake URL
func GenerateFakeURL() string {
	// Generate a random subdomain (optional)
	subdomain := ""
	if rand.Intn(2) == 1 {
		subdomain = GenerateRandomString(rand.Intn(10)+1) + "."
	}

	// Generate a random domain name
	domain := GenerateRandomString(rand.Intn(15) + 5)

	// Choose a random TLD
	tld := tlds[rand.Intn(len(tlds))]

	return fmt.Sprintf("https://%s%s%s", subdomain, domain, tld)
}
