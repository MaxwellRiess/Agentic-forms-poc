# Driving the POC with a real agent (Claude)

The scripted demo (`npm run demo`) proves the flow offline. To watch a real LLM
agent do it, connect Claude to the MCP server.

## Claude Desktop / Claude Code MCP config

```json
{
  "mcpServers": {
    "govuk-forms": {
      "command": "npx",
      "args": ["tsx", "bin/mcp.ts"],
      "cwd": "/absolute/path/to/Agentic-forms-poc"
    }
  }
}
```

## Prompts to try

- "There's a deep pothole on Acacia Avenue near number 42 in Leeds, about 30cm
  wide — a cyclist nearly came off. Report it to the council for me."
- "I want to apply for a residents parking permit for my car, reg AB12 CDE,
  starting next Monday. I live at 10 Downing Street, London, SW1A 2AA."
- "Help me register my new café, 'The Daily Grind', as a food business. I'm the
  owner — we'll prepare and sell food, opening on 1 September."

The agent should: call `list_forms`, pick the right service, call `describe_form`
to learn the questions, ask you only for genuinely missing required details, then
call `submit_form` and report the reference and what happens next.
