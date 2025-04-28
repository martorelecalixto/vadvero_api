// Importar libs
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

// Inicializar o app
const app = express();
const port = process.env.PORT || 3000;

//const bcrypt = require('bcrypt');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Recomenda-se usar variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET || 'secretao_top_123'; // Troque isso em produção!


// Middlewares
app.use(cors());
app.use(express.json());

// Swagger config
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Departamentos e Usuários',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./app.js'],
};

const specs = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Middleware de autenticação (coloque depois de const app = express())
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, usuario) => {
    if (err) return res.sendStatus(403);
    req.usuario = usuario;
    next();
  });
}



// Rotas

/**
 * @swagger
 * /departamentos:
 *   get:
 *     summary: Lista departamentos (com filtros opcionais por id ou nome)
 *     tags: [Departamentos]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         required: false
 *         description: ID do departamento
 *       - in: query
 *         name: nome
 *         schema:
 *           type: string
 *         required: false
 *         description: Nome do departamento
 *     responses:
 *       200:
 *         description: Lista de departamentos
 *       500:
 *         description: Erro interno no servidor
 */
app.get('/departamentos', async (req, res) => {
  const { id, nome } = req.query;

  let query = 'SELECT * FROM departamento';
  const params = [];

  if (id || nome) {
    query += ' WHERE';
    if (id) {
      params.push(id);
      query += ` id = $${params.length}`;
    }
    if (nome) {
      if (params.length > 0) query += ' AND';
      params.push(`%${nome}%`);
      query += ` nome ILIKE $${params.length}`;
    }
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /departamentos:
 *   post:
 *     summary: Cria um novo departamento
 *     tags: [Departamentos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *     responses:
 *       200:
 *         description: Departamento criado
 */
app.post('/departamentos', async (req, res) => {
  const { nome } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO departamento (nome) VALUES ($1) RETURNING *',
      [nome]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /departamentos/{id}:
 *   put:
 *     summary: Atualiza um departamento
 *     tags: [Departamentos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do departamento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *     responses:
 *       200:
 *         description: Departamento atualizado
 *       404:
 *         description: Departamento não encontrado
 *       500:
 *         description: Erro interno
 */
app.put('/departamentos/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'Nome é obrigatório para atualização.' });
  }

  try {
    const result = await pool.query('UPDATE departamento SET nome = $1 WHERE id = $2 RETURNING *', [nome, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * @swagger
 * /departamentos/{id}:
 *   delete:
 *     summary: Exclui um departamento pelo ID
 *     tags: [Departamentos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do departamento
 *     responses:
 *       200:
 *         description: Departamento deletado com sucesso
 *       404:
 *         description: Departamento não encontrado
 *       500:
 *         description: Erro interno no servidor
 */
app.delete('/departamentos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM departamento WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }
    res.json({ mensagem: 'Departamento deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Cria um novo usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - email
 *               - senha
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 */
app.post('/usuarios', async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const hash = await bcrypt.hash(senha, 12); // 12 rounds = seguro e eficiente

    const result = await pool.query(
      'INSERT INTO usuario (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email',
      [nome, email, hash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email já cadastrado' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});


/**
 * @swagger
 * /login:
 *   post:
 *     summary: Autentica o usuário e retorna um token JWT + dados do usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - senha
 *             properties:
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login bem-sucedido
 */
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const result = await pool.query('SELECT * FROM usuario WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const usuario = result.rows[0];

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



/**
 * @swagger
 * /empresas:
 *   post:
 *     summary: Cria uma nova empresa (requere autenticação JWT)
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - email
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               cnpj:
 *                 type: string
 *               telefone1:
 *                 type: string
 *               telefone2:
 *                 type: string
 *               celular1:
 *                 type: string
 *               celular2:
 *                 type: string
 *               cep:
 *                 type: string
 *               logradouro:
 *                 type: string
 *               numero:
 *                 type: string
 *               complemento:
 *                 type: string
 *               bairro:
 *                 type: string
 *               cidade:
 *                 type: string
 *               uf:
 *                 type: string
 *     responses:
 *       201:
 *         description: Empresa criada com sucesso
 *       409:
 *         description: Email já cadastrado
 *       500:
 *         description: Erro interno no servidor
 */
app.post('/empresas', autenticarToken, async (req, res) => {
  const { nome, email, cnpj, telefone1, telefone2, celular1, celular2, cep, logradouro, numero, complemento, bairro, cidade, uf } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO empresa (nome, email, cnpj, telefone1, telefone2, celular1, celular2, cep, logradouro, numero, complemento, bairro, cidade, uf) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id, nome, email, cnpj, telefone1, telefone2, celular1, celular2, cep, logradouro, numero, complemento, bairro, cidade, uf',
      [nome, email, cnpj, telefone1, telefone2, celular1, celular2, cep, logradouro, numero, complemento, bairro, cidade, uf]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email já cadastrado' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});


/**
 * @swagger
 * /empresas:
 *   get:
 *     summary: Lista empresas (filtro opcional por id, nome ou cnpj)
 *     tags: [Empresas]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         required: false
 *         description: ID da empresa
 *       - in: query
 *         name: nome
 *         schema:
 *           type: string
 *         required: false
 *         description: Nome da empresa
 *       - in: query
 *         name: cnpj
 *         schema:
 *           type: string
 *         required: false
 *         description: CNPJ da empresa
 *     responses:
 *       200:
 *         description: Lista de empresas
 *       500:
 *         description: Erro interno
 */
app.get('/empresas', autenticarToken, async (req, res) => {
  const { id, nome, cnpj } = req.query;

  let query = 'SELECT * FROM empresa';
  const params = [];

  if (id || nome || cnpj) {
    query += ' WHERE';
    if (id) {
      params.push(id);
      query += ` id = $${params.length}`;
    }
    if (nome) {
      if (params.length > 0) query += ' AND';
      params.push(`%${nome}%`);
      query += ` nome ILIKE $${params.length}`;
    }
    if (cnpj) {
      if (params.length > 0) query += ' AND';
      params.push(cnpj);
      query += ` cnpj = $${params.length}`;
    }
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /empresas/{id}:
 *   put:
 *     summary: Atualiza uma empresa
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da empresa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               cnpj:
 *                 type: string
 *               telefone1:
 *                 type: string
 *               telefone2:
 *                 type: string
 *               celular1:
 *                 type: string
 *               celular2:
 *                 type: string
 *               cep:
 *                 type: string
 *               logradouro:
 *                 type: string
 *               numero:
 *                 type: string
 *               complemento:
 *                 type: string
 *               bairro:
 *                 type: string
 *               cidade:
 *                 type: string
 *               uf:
 *                 type: string
 *     responses:
 *       200:
 *         description: Empresa atualizada
 *       404:
 *         description: Empresa não encontrada
 *       500:
 *         description: Erro interno
 */
app.put('/empresas/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar foi enviado.' });
  }

  const updates = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const values = Object.values(fields);

  try {
    const result = await pool.query(
      `UPDATE empresa SET ${updates} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * @swagger
 * /empresas/{id}:
 *   delete:
 *     summary: Deleta uma empresa pelo ID
 *     tags: [Empresas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da empresa
 *     responses:
 *       200:
 *         description: Empresa deletada com sucesso
 *       404:
 *         description: Empresa não encontrada
 *       500:
 *         description: Erro interno
 */
app.delete('/empresas/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM empresa WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }
    res.json({ mensagem: 'Empresa deletada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// (outros métodos PUT e DELETE também aqui, como já montamos)

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
