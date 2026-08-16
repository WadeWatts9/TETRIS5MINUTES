const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Asegurar que la carpeta 'data' exista para la persistencia del volumen en Docker
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'scores.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite en:', dbPath);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error al crear la tabla scores:', err.message);
    } else {
      console.log('Tabla scores inicializada correctamente.');
    }
  });
}

/**
 * Guarda un nuevo puntaje en la base de datos.
 * @param {string} name 
 * @param {number} score 
 * @returns {Promise<void>}
 */
function saveScore(name, score) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO scores (name, score) VALUES (?, ?)`;
    db.run(query, [name, score], function(err) {
      if (err) {
        console.error('Error al guardar el puntaje:', err.message);
        reject(err);
      } else {
        console.log(`Puntaje guardado: ${name} - ${score} (ID: ${this.lastID})`);
        resolve();
      }
    });
  });
}

/**
 * Obtiene los 10 mejores puntajes históricos sin importar si el jugador se repite.
 * @returns {Promise<Array>} Listado de los 10 mejores puntajes.
 */
function getTopScores() {
  return new Promise((resolve, reject) => {
    const query = `SELECT id, name, score, date FROM scores ORDER BY score DESC, date DESC LIMIT 10`;
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error al obtener los puntajes:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Obtiene todos los puntajes de la base de datos (para el panel de administración).
 * @returns {Promise<Array>} Listado de todos los puntajes.
 */
function getAllScores() {
  return new Promise((resolve, reject) => {
    const query = `SELECT id, name, score, date FROM scores ORDER BY score DESC, date DESC`;
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error al obtener todos los puntajes:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Elimina un puntaje específico por su ID.
 * @param {number} id 
 * @returns {Promise<void>}
 */
function deleteScore(id) {
  return new Promise((resolve, reject) => {
    const query = `DELETE FROM scores WHERE id = ?`;
    db.run(query, [id], function(err) {
      if (err) {
        console.error(`Error al eliminar puntaje con ID ${id}:`, err.message);
        reject(err);
      } else {
        console.log(`Puntaje eliminado con ID: ${id}`);
        resolve();
      }
    });
  });
}

module.exports = {
  saveScore,
  getTopScores,
  getAllScores,
  deleteScore
};
