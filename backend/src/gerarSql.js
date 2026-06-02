const fs = require('fs');
const path = require('path');

const caminhoEscolasJson = path.join(__dirname, '..', 'escolas_final_pb.json');

if (!fs.existsSync(caminhoEscolasJson)) {
  console.error('❌ Erro: O arquivo "escolas_final_pb.json" não foi encontrado.');
  process.exit(1);
}

const listaEscolas = JSON.parse(fs.readFileSync(caminhoEscolasJson, 'utf-8'));

let sqlConteudo = `
-- ===================================================
-- SCRIPT DE INSERÇÃO COMPACTADO (BATCH/MULTI-ROWS)
-- ===================================================
DROP TABLE IF EXISTS escolas CASCADE;

CREATE TABLE escolas (
  id_escola INT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  id_municipio INT REFERENCES municipios(id_municipio),
  rede_ensino INT,
  latitude FLOAT,
  longitude FLOAT,
  oferece_infantil INT,
  oferece_fundamental INT,
  oferece_medio INT,
  oferece_eja INT,
  oferece_profissional INT,
  total_matriculas INT,
  total_docentes INT,
  ideb DECIMAL(2,1)
);
`;

// Define o tamanho dos blocos (inserir de 500 em 500 reduz drasticamente o tamanho do texto)
const TAMANHO_BLOCO = 500;

for (let i = 0; i < listaEscolas.length; i += TAMANHO_BLOCO) {
  const bloco = listaEscolas.slice(i, i + TAMANHO_BLOCO);
  
  sqlConteudo += `\nINSERT INTO escolas (id_escola, nome, id_municipio, rede_ensino, latitude, longitude, oferece_infantil, oferece_fundamental, oferece_medio, oferece_eja, oferece_profissional, total_matriculas, total_docentes, ideb) VALUES \n`;

  const linhasValores = bloco.map((escola) => {
    const nomeEscolaEscapado = escola.nome.replace(/'/g, "''");
    const idMunicipio = escola.id_municipio ? escola.id_municipio : 'NULL';
    const lat = escola.latitude !== null ? escola.latitude : 'NULL';
    const lng = escola.longitude !== null ? escola.longitude : 'NULL';

    return `(${escola.id_escola}, '${nomeEscolaEscapado}', ${idMunicipio}, ${escola.rede_ensino}, ${lat}, ${lng}, ${escola.oferece_infantil}, ${escola.oferece_fundamental}, ${escola.oferece_medio}, ${escola.oferece_eja}, ${escola.oferece_profissional}, ${escola.total_matriculas}, ${escola.total_docentes}, ${escola.ideb})`;
  });

  // Junta todas as linhas do bloco separando por vírgula e fecha com ponto e vírgula
  sqlConteudo += linhasValores.join(',\n') + ';\n';
}

const caminhoSqlFinal = path.join(__dirname, '..', 'inserir_escolas_final.sql');
fs.writeFileSync(caminhoSqlFinal, sqlConteudo);

console.log(`\n🚀 SCRIPT COMPACTADO GERADO!`);
console.log(`📂 Salvo em: ${caminhoSqlFinal}`);
console.log(`✨ Dados estruturados em blocos de performance prontos para o Supabase.`);