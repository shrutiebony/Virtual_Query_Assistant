# DB Assistant — React Frontend

## Setup

```bash
cd db-assistant-ui
npm install
npm start
```

App runs at http://localhost:3000
Backend must be running at http://localhost:8000

## Structure

```
src/
  pages/
    LoginPage.jsx         ← Login
    RegisterPage.jsx      ← Register
    DashboardPage.jsx     ← Home dashboard
    PostgresPage.jsx      ← PostgreSQL NL query
    MongoPage.jsx         ← MongoDB NL query
    DatasetsPage.jsx      ← Upload & query CSV/Excel
    ConnectionsPage.jsx   ← Manage DB connections

  components/
    layout/AppLayout.jsx  ← Sidebar + routing shell
    ui/index.jsx          ← Button, Input, Card, Badge etc.
    ui/ResultsPanel.jsx   ← Shared results (Table/Chart/EDA)

  context/AuthContext.jsx ← JWT auth state
  services/api.js         ← All API calls
```

## .env
```
REACT_APP_API_URL=http://localhost:8000
```
