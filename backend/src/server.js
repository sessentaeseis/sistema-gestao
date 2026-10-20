import "dotenv/config"
import express from "express"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { prisma } from "./lib/prisma.ts"

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET
const TEMPO_SESSAO = "2h"

if (!JWT_SECRET) {
  throw new Error("Defina JWT_SECRET no arquivo .env")
}

app.use(cors())
app.use(express.json())

async function autenticar(req, res, next) {
  try {
    const autorizacao = req.headers.authorization

    if (!autorizacao || !autorizacao.startsWith("Bearer ")) {
      return res.status(401).json({
        erro: "Token não informado.",
      })
    }

    const token = autorizacao.split(" ")[1]

    let payload

    try {
      payload = jwt.verify(token, JWT_SECRET)
    } catch {
      return res.status(401).json({
        erro: "Token inválido ou expirado.",
      })
    }

    const sessao = await prisma.sessao.findUnique({
      where: { token: token },
      include: { usuario: true },
    })

    if (
      !sessao ||
      sessao.encerrada_em ||
      sessao.expira_em <= new Date() ||
      String(sessao.usuario_id) !== String(payload.sub)
    ) {
      return res.status(401).json({
        erro: "Sessão inválida, encerrada ou expirada.",
      })
    }

    req.usuario = sessao.usuario
    req.sessao = sessao

    next()
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao autenticar usuário.",
    })
  }
}

app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body

    if (!email || !senha) {
      return res.status(400).json({
        erro: "Informe e-mail e senha.",
      })
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email },
    })

    if (
      !usuario ||
      !(await bcrypt.compare(senha, usuario.senha))
    ) {
      return res.status(401).json({
        erro: "E-mail ou senha inválidos.",
      })
    }

    const expira_em = new Date(
      Date.now() + 2 * 60 * 60 * 1000
    )

    const token = jwt.sign(
      { sub: String(usuario.id) },
      JWT_SECRET,
      { expiresIn: TEMPO_SESSAO }
    )

    await prisma.sessao.create({
      data: {
        token: token,
        expira_em,
        usuario_id: usuario.id,
      },
    })

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      token,
      expira_em,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
    })
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao realizar login.",
    })
  }
})

// ==================================================
// USUÁRIO AUTENTICADO
// GET /me
// ==================================================

app.get("/me", autenticar, (req, res) => {
  return res.json({
    id: req.usuario.id,
    nome: req.usuario.nome,
    email: req.usuario.email,
  })
})

app.post("/logout", autenticar, async (req, res) => {
  try {
    await prisma.sessao.update({
      where: { id: req.sessao.id },
      data: { encerrada_em: new Date() },
    })

    return res.json({
      mensagem: "Logout realizado com sucesso.",
    })
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao encerrar sessão.",
    })
  }
})

app.get("/usuarios", autenticar, async (req, res) => {
  try {
    const busca = req.query.busca?.trim()

    const usuarios = await prisma.usuario.findMany({
      where: busca
        ? {
            OR: [
              {
                nome: {
                  contains: busca,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: busca,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
      select: {
        id: true,
        nome: true,
        email: true,
      },
      orderBy: { nome: "asc" },
    })

    return res.json(usuarios)
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao listar usuários.",
    })
  }
})

app.post("/criarusuarios", async (req, res) => {
  try {
    const { nome, email, senha, cpf } = req.body

    if (!nome || !email || !senha || !cpf) {
      return res.status(400).json({
        erro: "Preencha todos os campos."
      })
    }

    const emailExistente = await prisma.usuario.findUnique({
      where: { email }
    })

    if (emailExistente) {
      return res.status(409).json({
        erro: "Este e-mail já está cadastrado."
      })
    }

    const cpfExistente = await prisma.usuario.findUnique({
      where: { cpf: String(cpf) }
    })

    if (cpfExistente) {
      return res.status(409).json({
        erro: "Este CPF já está cadastrado."
      })
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        cpf: String(cpf)
      },
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true
      }
    })

    return res.status(201).json({
      mensagem: "Usuário criado com sucesso.",
      usuario
    })
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao criar usuário."
    })
  }
})

app.post("/usuarios", autenticar, async (req, res) => {
  try {
    const { nome, email, senha, cpf } = req.body

    if (
      !nome?.trim() ||
      !email?.trim() ||
      !senha ||
      cpf === undefined ||
      cpf === null
    ) {
      return res.status(400).json({
        erro: "Preencha nome, e-mail, senha e CPF.",
      })
    }

    const cpfTexto = String(cpf)

    if (!/^\d{11}$/.test(cpfTexto)) {
      return res.status(400).json({
        erro: "O CPF deve conter 11 dígitos.",
      })
    }

    if (!Number.isSafeInteger(cpfTexto)) {
      return res.status(400).json({
        erro: "CPF incompatível com o tipo definido no schema.",
      })
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    const usuario = await prisma.usuario.create({
      data: {
        nome: nome.trim(),
        email: email.trim(),
        senha: senhaHash,
        cpf: cpfTexto,
      },
      select: {
        id: true,
        nome: true,
        email: true,
      },
    })

    return res.status(201).json(usuario)
  } catch (erro) {
    if (erro.code === "P2002") {
      return res.status(409).json({
        erro: "E-mail ou CPF já cadastrado.",
      })
    }

    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao cadastrar usuário.",
    })
  }
})

app.get("/listas", autenticar, async (req, res) => {
  try {
    const listas = await prisma.listaTarefas.findMany({
      where: {
        criador_id: req.usuario.id,
      },
      include: {
        criador: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
        tarefas: {
          orderBy: { prazo: "asc" },
          include: {
            responsavel: {
              select: {
                id: true,
                nome: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { criada_em: "desc" },
    })

    return res.json(listas)
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao listar listas de tarefas.",
    })
  }
})

app.post("/listas", autenticar, async (req, res) => {
  try {
    const { nome, descricao } = req.body

    if (!nome?.trim()) {
      return res.status(400).json({
        erro: "O nome da lista é obrigatório.",
      })
    }

    const lista = await prisma.listaTarefas.create({
      data: {
        nome: nome.trim(),
        descricao,
        criador_id: req.usuario.id,
      },
    })

    return res.status(201).json(lista)
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao criar lista.",
    })
  }
})

app.get("/tarefas", autenticar, async (req, res) => {
  try {
    const tarefas = await prisma.tarefa.findMany({
      where: {
        lista: {
          criador_id: req.usuario.id,
        },
      },
      include: {
        lista: true,
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
      orderBy: { prazo: "asc" },
    })

    return res.json(tarefas)
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao listar tarefas.",
    })
  }
})

app.post("/tarefas", autenticar, async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      status,
      prazo,
      lista_id,
      responsavel_id,
    } = req.body

    if (
      !titulo?.trim() ||
      !prazo ||
      lista_id === undefined ||
      responsavel_id === undefined
    ) {
      return res.status(400).json({
        erro: "Informe título, prazo, lista e responsável.",
      })
    }

    const listaId = Number(lista_id)
    const responsavelId = Number(responsavel_id)
    const dataPrazo = new Date(prazo)

    if (
      !Number.isInteger(listaId) ||
      listaId <= 0 ||
      !Number.isInteger(responsavelId) ||
      responsavelId <= 0
    ) {
      return res.status(400).json({
        erro: "IDs da lista e do responsável inválidos.",
      })
    }

    if (Number.isNaN(dataPrazo.getTime())) {
      return res.status(400).json({
        erro: "Prazo inválido.",
      })
    }

    const lista = await prisma.listaTarefas.findFirst({
      where: {
        id: listaId,
        criador_id: req.usuario.id,
      },
    })

    if (!lista) {
      return res.status(404).json({
        erro: "Lista não encontrada ou sem permissão.",
      })
    }

    const responsavel = await prisma.usuario.findUnique({
      where: { id: responsavelId },
    })

    if (!responsavel) {
      return res.status(404).json({
        erro: "Responsável não encontrado.",
      })
    }

    const tarefa = await prisma.tarefa.create({
      data: {
        titulo: titulo.trim(),
        descricao,
        status: status || "PENDENTE",
        prazo: dataPrazo,
        lista_id: listaId,
        responsavel_id: responsavelId,
      },
      include: {
        lista: true,
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    })

    return res.status(201).json(tarefa)
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao cadastrar tarefa.",
    })
  }
})

app.get("/agendamentos", autenticar, async (req, res) => {
  try {
    const tarefas = await prisma.tarefa.findMany({
      where: {
        lista: {
          criador_id: req.usuario.id,
        },
      },
      include: {
        lista: true,
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
      orderBy: { prazo: "asc" },
    })

    return res.json(tarefas)
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao listar agendamentos.",
    })
  }
})

app.get("/agendamentos/:id", autenticar, async (req, res) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        erro: "ID inválido.",
      })
    }

    const tarefa = await prisma.tarefa.findFirst({
      where: {
        id,
        lista: {
          criador_id: req.usuario.id,
        },
      },
      include: {
        lista: true,
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    })

    if (!tarefa) {
      return res.status(404).json({
        erro: "Agendamento não encontrado.",
      })
    }

    return res.json(tarefa)
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      erro: "Erro ao consultar agendamento.",
    })
  }
})

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})
