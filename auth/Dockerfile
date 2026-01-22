# Etapa 1: Build (Folosim Maven cu Java 21)
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# 1. Cache pentru dependințe
COPY pom.xml .
RUN mvn dependency:go-offline -B

# 2. Copiem sursele și cheile RSA în resources
COPY src ./src
COPY auth.key ./src/main/resources/
COPY auth.pub ./src/main/resources/

# 3. Build JAR
RUN mvn clean package -DskipTests

# Etapa 2: Runtime (Imagine minimalistă cu JRE 21)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copiem doar executabilul
COPY --from=build /app/target/*.jar app.jar

# Utilizator non-root pentru securitate sporită în Azure
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

ENTRYPOINT ["java", "-jar", "app.jar"]