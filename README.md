## In order to run the application, docker must be installed on the machine
```sh
$ docker compose up -d --build # this command automatically builds the docker images
                               # and keep the containers running in detatched mode
```

## To simulate the energy consumption of the devices, run the following command:
```sh
$ python ./data_simulator/main.py
```

### generate a public - private key for auth-service (in the same folder where application.properties is located)

```sh
$ openssl genrsa -out app.key 2048
```

### extract the public key (for JWT)

```sh
$ openssl rsa -in app.key -pubout > app.pub
```

### generate certificate (CA for ssl)

```sh
$ openssl req -x509 -key nginx.key -out site.crt -days 365
```

