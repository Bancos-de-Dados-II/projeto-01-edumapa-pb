const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const frontendPath = path.join(__dirname, '..', '..', 'frontedn');


const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});


app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});


app.get('/api/municipios', async (req, res) => {
  try {
    
    const queryText = `
      SELECT 
        id_municipio, 
        nome, 
        ST_AsGeoJSON(geom)::json AS geometry 
      FROM municipios
      ORDER BY nome ASC;
    `;
    
    const { rows } = await pool.query(queryText);
    
    
    const geojson = {
      type: "FeatureCollection",
      features: rows.map(row => ({
        type: "Feature",
        properties: {
          id_municipio: row.id_municipio,
          nome: row.nome
        },
        geometry: row.geometry
      }))
    };

    res.json(geojson);
  } catch (error) {
    console.error('❌ Erro ao buscar municípios:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar os dados espaciais.' });
  }
});


app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`📡 Servidor rodando localmente na porta ${PORT}`);
  console.log(`🔗 Frontend disponível em http://localhost:${PORT}`);
  console.log(`🔗 API de municípios disponível em http://localhost:${PORT}/api/municipios`);
});