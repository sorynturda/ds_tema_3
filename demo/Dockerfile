FROM maven:3.9.9

WORKDIR /app

COPY pom.xml .

RUN mvn dependency:go-offline

EXPOSE 2000

CMD ["mvn", "spring-boot:run"]
