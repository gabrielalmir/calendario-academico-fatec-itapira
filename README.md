# Calendario FATEC

## Descrição
Projeto de calendário para a FATEC que extrai automaticamente eventos acadêmicos de PDFs e sincroniza com Todoist usando IA (Gemini).

## Funcionalidades
- Extração automática de calendário acadêmico via PDF com IA
- Sincronização com Todoist
- Gerenciamento automático de tarefas por semestre
- Filtro de eventos passados
- Download automático de calendários

## Requisitos
- Bun (runtime JavaScript)
- Node.js 14+
- Chaves de API: Todoist e Google Gemini
- Variáveis de ambiente configuradas

## Instalação
```bash
bun install
```

## Uso
```bash
bun run src/main.ts
```

## Configuração
Configure as seguintes variáveis de ambiente:
- `TODOIST_API_KEY`: Chave da API Todoist
- `TODOIST_PROJECT_ID`: ID do projeto Todoist
- `TODOIST_SECTION_ID`: ID da seção Todoist
- `GEMINI_API_KEY`: Chave da API Google Gemini

## Contribuindo
Para contribuir, faça um fork do projeto e envie um pull request.

## Licença
MIT

## Contato
Para dúvidas, abra uma issue no repositório.
