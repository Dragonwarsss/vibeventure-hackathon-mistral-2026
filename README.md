# vibeventure

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose

## Lancer le projet

```bash
docker compose up --build
```

| Service  | URL                    |
|----------|------------------------|
| Back     | http://localhost:3000  |
| Front    | http://localhost:5173  |
| Postgres | localhost:5432         |
| Redis    | localhost:6379         |

## Arrêter

```bash
docker compose down
```

Pour supprimer aussi les volumes (base de données) :

```bash
docker compose down -v
```
