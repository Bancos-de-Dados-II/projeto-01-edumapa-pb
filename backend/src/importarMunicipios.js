const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function iniciarImportacao() {
  try {
    
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✅ Extensão PostGIS garantida.');

    
    await pool.query('DROP TABLE IF EXISTS municipios CASCADE;');

    
    await pool.query(`
      CREATE TABLE municipios (
        id_municipio INT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        geom GEOMETRY(MultiPolygon, 4326)
      );
    `);
    console.log('✅ Tabela "municipios" recriada com a estrutura correta.');

    
    const caminhoJson = path.join(__dirname, '..', 'PB_Municipios_2025.json');
    const dadosBrutos = fs.readFileSync(caminhoJson, 'utf-8');
    const geojson = JSON.parse(dadosBrutos);

    console.log(`⏳ Lendo ${geojson.features.length} municípios do arquivo...`);

    
    for (const feature of geojson.features) {
      const props = feature.properties;
      
      
      const id = props.id_municipio || props.code_muni || props.CD_MUN || props.CD_MUNICIPIO;
      const nome = props.nome || props.name_muni || props.NM_MUN || props.NM_MUNICIPIO;
      const geometria = JSON.stringify(feature.geometry);

      if (!id || !nome) {
        console.log('⚠️ Alerta: Campos não encontrados nesta feature:', props);
        continue;
      }

      const queryText = `
        INSERT INTO municipios (id_municipio, nome, geom)
        VALUES ($1, $2, ST_GeomFromGeoJSON($3))
        ON CONFLICT (id_municipio) DO NOTHING;
      `;

      await pool.query(queryText, [id, nome, geometria]);
    }

    console.log('🚀 Sucesso! Todos os 223 municípios da Paraíba foram importados!');
  } catch (error) {
    console.error('❌ Erro na importação:', error);
  } finally {
    await pool.end();
  }
}


iniciarImportacao();