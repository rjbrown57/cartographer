package config

/*
Package config provides a type for configFiles for cartographer.

Example config

```
apiVersion: v1beta
namespace: default
cartographer:
  address: 0.0.0.0
  port: 8080
notes:
  - url: https://github.com/kubernetes/kubernetes
    tags: ["k8s"]
    body: |-
      kubernetes core github repository
    title: github kube
  - url: https://github.com/goharbor/harbor
    tags: ["oci", "k8s"]
```

*/
