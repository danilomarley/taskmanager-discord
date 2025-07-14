// database.js
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, 'data.json');

// Carrega ou inicializa os dados
let data = {
  atividades: []
};

// Tenta carregar os dados salvos do arquivo
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);

      // Garante estrutura mínima
      data = {
        atividades: Array.isArray(parsed.atividades) ? parsed.atividades : []
      };

      normalizeData();
    } catch (e) {
      console.error('❌ Erro ao carregar data.json:', e.message);
    }
  }
}


function normalizeData() {
  for (const atividade of data.atividades) {
    atividade.id ??= uuidv4(); // ✅ Garante que toda atividade tenha um ID
    atividade.metas ??= [];
    atividade.messageIds ??= [];
    for (const meta of atividade.metas) {
      meta.progresso ??= 0;
      meta.contribuidores ??= {};
      meta.ajudantes ??= {};
    }
  }
}

// Salva os dados no arquivo
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Erro ao salvar data.json:', err.message);
  }
}

// Função opcional para reset (uso seguro em testes)
function resetData() {
  data = { atividades: [] };
  saveData();
}

loadData();

module.exports = {
  data,
  saveData,
  resetData
};
