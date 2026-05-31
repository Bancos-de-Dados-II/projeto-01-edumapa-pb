const fs = require('fs');
const path = require('path');

// 1. Lê o seu arquivo GeoJSON local
const caminhoJson = path.join(__dirname, '..', 'PB_Municipios_2025.json');
const dadosBrutos = fs.readFileSync(caminhoJson, 'utf-8');
const geojson = JSON.parse(dadosBrutos);

// 2. Prepara o cabeçalho do arquivo SQL
let sqlConteudo = `
-- Ativa o PostGIS e recria a tabela na nuvem do Supabase
CREATE EXTENSION IF NOT EXISTS postgis;
DROP TABLE IF EXISTS municipios CASCADE;

CREATE TABLE municipios (
  id_municipio INT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  geom GEOMETRY(MultiPolygon, 4326)
);

-- Início da inserção das cidades
`;

// 3. Transforma cada cidade em uma linha de comando SQL pura
for (const feature of geojson.features) {
  const props = feature.properties;
  const id = props.id_municipio || props.code_muni || props.CD_MUN || props.CD_MUNICIPIO;
  const nome = props.nome || props.name_muni || props.NM_MUN || props.NM_MUNICIPIO;
  
  // Trata nomes com aspas simples (ex: Sant'Ana) para não quebrar o SQL
  const nomeEscapado = nome.replace(/'/g, "''");
  const geometria = JSON.stringify(feature.geometry);

  sqlConteudo += `INSERT INTO municipios (id_municipio, nome, geom) VALUES (${id}, '${nomeEscapado}', ST_GeomFromGeoJSON('${geometria}'));\n`;
}

// 4. Salva o arquivo final na raiz do projeto
fs.writeFileSync(path.join(__dirname, '..', 'inserir_municipios.sql'), sqlConteudo);
console.log('✅ Arquivo "inserir_municipios.sql" gerado com sucesso na raiz do seu projeto!');