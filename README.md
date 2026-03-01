# vibeventure

## Lancer le jeu (front uniquement)

> Seul le front est nécessaire pour jouer.

```bash
cd front
npm install
npm run dev
```

Ouvre ensuite [http://localhost:5173](http://localhost:5173) dans ton navigateur.

### Variable d'environnement requise

Crée un fichier `front/.env.local` avec ta clé API Mistral :

```env
VITE_MISTRAL_API_KEY=your_mistral_api_key_here
```

---

## Stack complète (Docker)

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose

### Lancer

```bash
docker compose up --build
```

| Service  | URL                    |
|----------|------------------------|
| Back     | http://localhost:3000  |
| Front    | http://localhost:5173  |
| Postgres | localhost:5432         |
| Redis    | localhost:6379         |

### Arrêter

```bash
docker compose down
```

Pour supprimer aussi les volumes (base de données) :

```bash
docker compose down -v
```
