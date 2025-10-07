# generate a public - private key

```sh
$ openssl genrsa -out app.key 2048
```

# extract the public key

```sh
$ openssl rsa -in app.key -pubout > app.pub
```
