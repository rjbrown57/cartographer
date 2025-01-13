{{- define "cartographer.configmap" -}}
{{ $dot := . }}
{{- range $path, $_ := .Files.Glob "config/*" }}
{{- $data := $.Files.Get $path }}
{{- printf "%s: |- " $path | trimPrefix "config/" | nindent 2 }}
{{- tpl $data $dot | nindent 4 }}
{{- end }}
{{- end -}}