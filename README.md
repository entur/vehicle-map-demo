# Vehicle Map Demo

Web app to demonstrate usage of realtime vehicle data from Entur.

## Running locally

```
npm ci
cp .github/environments/config-dev.json public/bootstrap.json
npm run dev
```

Then open http://localhost:5173. `public/bootstrap.json` holds the API endpoints and is gitignored; edit your copy to point at another backend.
