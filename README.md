# generate a public - private key

```sh
$ openssl genrsa -out app.key 2048
```

# extract the public key (for JWT)

```sh
$ openssl rsa -in app.key -pubout > app.pub
```

# generate certificate (CA for ssl)

```sh
$ openssl req -x509 -key private.key -out certificate.crt -days 365
```



