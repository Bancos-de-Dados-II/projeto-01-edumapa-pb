const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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


// endpoint para retornar escolas do JSON (suporta ?municipio=ID)
function resolveEscolasFile() {
  const candidates = [
    path.resolve(__dirname, '..', 'escolas_final_pb.json'),
    path.resolve(__dirname, '..', '..', 'escolas_final_pb.json'),
    path.resolve(__dirname, '..', '..', 'backend', 'escolas_final_pb.json')
  ];
  return candidates.find(c => fs.existsSync(c));
}

app.get('/api/escolas', async (req, res) => {
  try {
    const arquivo = resolveEscolasFile();
    if (!arquivo) {
      console.error('❌ Arquivo de escolas não encontrado em nenhum caminho válido.');
      return res.status(404).json({ error: 'Arquivo de escolas não encontrado.' });
    }
    const txt = fs.readFileSync(arquivo, 'utf8');
    const lista = JSON.parse(txt);

    const { municipio } = req.query;
    if (municipio) {
      const filtro = String(municipio);
      return res.json(lista.filter(e => String(e.id_municipio) === filtro));
    }

    res.json(lista);
  } catch (error) {
    console.error('❌ Erro ao buscar escolas:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar escolas.' });
  }
});

// catch-all: serve frontend
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`📡 Servidor rodando localmente na porta ${PORT}`);
  console.log(`🔗 Frontend disponível em http://localhost:${PORT}`);
  console.log(`🔗 API de municípios disponível em http://localhost:${PORT}/api/municipios`);
  console.log(`🔗 API de escolas disponível em http://localhost:${PORT}/api/escolas`);
});