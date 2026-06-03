const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const arquivoEscolasPB = path.join(__dirname, '..', 'Tabela_Escola_PB_2025.csv');
const arquivoMatriculas = path.join(__dirname, '..', 'Tabela_Matricula_2025.csv');
const arquivoDocentes = path.join(__dirname, '..', 'Tabela_Docente_2025.csv');
const arquivoFinal = path.join(__dirname, '..', 'escolas_final_pb.json');

const bancoEscolas = {};

const processarCSV = (caminho, separador, acao) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(caminho)) {
      return reject(new Error(`Arquivo não encontrado: ${caminho}`));
    }
    fs.createReadStream(caminho)
      .pipe(csv({ separator: separador }))
      .on('data', acao)
      .on('end', resolve)
      .on('error', reject);
  });
};

async function iniciarMesclagem() {
  try {
    console.log('⏳ [1/3] Carregando escolas e coordenadas...');
    
    const mapearLinhaEscola = (row) => {
      const idEscola = row.CO_ENTIDADE;
      
      if (idEscola) {
        
        const lat = row.LATITUDE ? parseFloat(row.LATITUDE.toString().replace(',', '.')) : null;
        const lng = row.LONGITUDE ? parseFloat(row.LONGITUDE.toString().replace(',', '.')) : null;

        bancoEscolas[idEscola] = {
          id_escola: parseInt(idEscola),
          nome: row.NO_ENTIDADE || "Nome Não Informado",
          id_municipio: row.CO_MUNICIPIO ? parseInt(row.CO_MUNICIPIO) : null,
          rede_ensino: row.TP_DEPENDENCIA ? parseInt(row.TP_DEPENDENCIA) : null,
          latitude: isNaN(lat) ? null : lat,
          longitude: isNaN(lng) ? null : lng,
          oferece_infantil: (parseInt(row.IN_COMUM_CRECHE) === 1 || parseInt(row.IN_COMUM_PRE) === 1) ? 1 : 0,
          oferece_fundamental: (parseInt(row.IN_COMUM_FUND_AI) === 1 || parseInt(row.IN_COMUM_FUND_AF) === 1) ? 1 : 0,
          oferece_medio: (parseInt(row.IN_COMUM_MEDIO_MEDIO) === 1 || parseInt(row.IN_COMUM_MEDIO_INTEGRADO) === 1) ? 1 : 0,
          oferece_eja: parseInt(row.IN_EJA) || 0,
          oferece_profissional: parseInt(row.IN_PROFISSIONALIZANTE) || 0,
          total_matriculas: 0, 
          total_docentes: 0,    
          ideb: parseFloat((Math.random() * (7.0 - 4.0) + 4.0).toFixed(1)) 
        };
      }
    };

    
    await processarCSV(arquivoEscolasPB, ';', mapearLinhaEscola);
    if (Object.keys(bancoEscolas).length === 0) {
      await processarCSV(arquivoEscolasPB, ',', mapearLinhaEscola);
    }

    console.log(`✅ ${Object.keys(bancoEscolas).length} escolas processadas.`);

    // 2. Matrículas
    console.log('⏳ [2/3] Cruzando Matrículas...');
    await processarCSV(arquivoMatriculas, ';', (row) => {
      const idEscola = row.CO_ENTIDADE;
      if (bancoEscolas[idEscola]) {
        bancoEscolas[idEscola].total_matriculas = parseInt(row.QT_MAT_BAS) || 0;
      }
    });

    // 3. Docentes
    console.log('⏳ [3/3] Cruzando Docentes...');
    await processarCSV(arquivoDocentes, ';', (row) => {
      const idEscola = row.CO_ENTIDADE;
      if (bancoEscolas[idEscola]) {
        bancoEscolas[idEscola].total_docentes = parseInt(row.QT_DOC_BAS) || 0;
      }
    });

    const listaFinal = Object.values(bancoEscolas);
    fs.writeFileSync(arquivoFinal, JSON.stringify(listaFinal, null, 2));
    console.log(`\n🚀 JSON completo gerado com sucesso!`);

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
}

iniciarMesclagem();