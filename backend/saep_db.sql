INSERT INTO "Usuario" (nome, email, senha, cpf) VALUES
('Antonio Vedana', 'antonio@exemplo.com', '<hash_bcrypt>', '11111111111'),
('Mariana Costa', 'mariana@exemplo.com', '<hash_bcrypt>', '22222222222'),
('Lucas Martins', 'lucas@exemplo.com', '<hash_bcrypt>', '33333333333');

INSERT INTO "ListaTarefas" (nome, descricao, criador_id) VALUES
('Projeto Integrador', 'Entregas do projeto escolar', 1),
('Sistema de Gestão', 'Desenvolvimento do sistema', 2),
('Documentação', 'Documentação técnica', 1);
INSERT INTO "ListaTarefas" (nome, descricao, criador_id) VALUES
('Projeto Integrador', 'Entregas do projeto escolar', 1),
('Sistema de Gestão', 'Desenvolvimento do sistema de tarefas', 2),
('Documentação', 'Documentação técnica e revisão', 1);

INSERT INTO "Tarefa"
(titulo, descricao, status, prazo, lista_id, responsavel_id) VALUES
('Modelar o banco de dados',
 'Definir entidades e relacionamentos',
 'CONCLUIDA', CURRENT_TIMESTAMP + INTERVAL '1 day', 1, 1),

('Implementar autenticação',
 'Criar login com JWT e bcrypt',
 'EM_ANDAMENTO', CURRENT_TIMESTAMP + INTERVAL '2 days', 2, 2),

('Criar tela de tarefas',
 'Implementar listagem e cadastro',
 'PENDENTE', CURRENT_TIMESTAMP + INTERVAL '3 days', 2, 3),

('Testar endpoints',
 'Validar as rotas da API',
 'PENDENTE', CURRENT_TIMESTAMP + INTERVAL '4 days', 2, 1),

('Escrever README',
 'Documentar instalação e execução',
 'EM_ANDAMENTO', CURRENT_TIMESTAMP + INTERVAL '5 days', 3, 2),

('Revisar entrega',
 'Conferir os requisitos do sistema',
 'PENDENTE', CURRENT_TIMESTAMP + INTERVAL '7 days', 3, 3);

INSERT INTO "Sessao"
(token, criada_em, expira_em, encerrada_em, usuario_id) VALUES
('sessao-demo-001', CURRENT_TIMESTAMP - INTERVAL '3 days',
 CURRENT_TIMESTAMP - INTERVAL '2 days',
 CURRENT_TIMESTAMP - INTERVAL '2 days', 1),

('sessao-demo-002', CURRENT_TIMESTAMP - INTERVAL '2 days',
 CURRENT_TIMESTAMP - INTERVAL '1 day',
 CURRENT_TIMESTAMP - INTERVAL '1 day', 2),

('sessao-demo-003', CURRENT_TIMESTAMP - INTERVAL '1 day',
 CURRENT_TIMESTAMP - INTERVAL '12 hours',
 CURRENT_TIMESTAMP - INTERVAL '12 hours', 3);