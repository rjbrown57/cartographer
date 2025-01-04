package config

/*
Package config provides a type for configFiles for cartographer.

Example config

```
apiVersion: v1beta
cartographer:
  address: 0.0.0.0
  port: 8080
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
```

*/
