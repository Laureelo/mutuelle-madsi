// Faux serveur SMTP pour les tests : reçoit les emails et les enregistre dans un fichier JSON (une ligne par message).
// Usage : node smtp-sink.js <port> <fichier-sortie>
const net = require('net');
const fs = require('fs');
const port = Number(process.argv[2] || 2525);
const out = process.argv[3] || 'mails.jsonl';
fs.writeFileSync(out, '');

function decodeQP(s) {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parse(raw) {
  const [head, ...rest] = raw.split(/\r?\n\r?\n/);
  const unfolded = head.replace(/\r?\n[ \t]+/g, ' ');
  const h = (name) => (unfolded.match(new RegExp('^' + name + ':\\s*(.*)$', 'mi')) || [])[1] || '';
  let sujet = h('Subject');
  const enc = sujet.match(/=\?UTF-8\?([BQ])\?(.*?)\?=/i);
  if (enc) sujet = enc[1].toUpperCase() === 'B' ? Buffer.from(enc[2], 'base64').toString('utf8') : Buffer.from(decodeQP(enc[2].replace(/_/g, ' ')), 'latin1').toString('utf8');
  return { to: h('To'), from: h('From'), replyTo: h('Reply-To'), sujet, corps: rest.join('\n\n') };
}

net.createServer((sock) => {
  let data = false, buf = '', mailFrom = '', rcpt = [];
  sock.write('220 sink ESMTP\r\n');
  sock.on('data', (chunk) => {
    buf += chunk.toString('latin1');
    while (true) {
      if (data) {
        const i = buf.indexOf('\r\n.\r\n');
        if (i < 0) return;
        const raw = buf.slice(0, i); buf = buf.slice(i + 5); data = false;
        const m = parse(raw);
        // décode le corps (quoted-printable / base64) pour pouvoir y chercher le lien
        let texte = m.corps;
        const b64 = [...texte.matchAll(/Content-Transfer-Encoding:\s*base64\r?\n\r?\n([A-Za-z0-9+\/=\r\n]+)/gi)].map(x => Buffer.from(x[1].replace(/\s+/g, ''), 'base64').toString('utf8')).join('\n');
        const qp = decodeQP(texte);
        fs.appendFileSync(out, JSON.stringify({ ...m, rcpt, mailFrom, texte: b64 + '\n' + Buffer.from(qp, 'latin1').toString('utf8') }) + '\n');
        sock.write('250 OK queued\r\n');
        continue;
      }
      const j = buf.indexOf('\r\n');
      if (j < 0) return;
      const line = buf.slice(0, j); buf = buf.slice(j + 2);
      const cmd = line.toUpperCase();
      if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) sock.write('250-sink\r\n250 8BITMIME\r\n');
      else if (cmd.startsWith('MAIL FROM')) { mailFrom = line; rcpt = []; sock.write('250 OK\r\n'); }
      else if (cmd.startsWith('RCPT TO')) { rcpt.push(line.slice(8)); sock.write('250 OK\r\n'); }
      else if (cmd === 'DATA') { data = true; sock.write('354 go\r\n'); }
      else if (cmd.startsWith('RSET')) sock.write('250 OK\r\n');
      else if (cmd.startsWith('NOOP')) sock.write('250 OK\r\n');
      else if (cmd.startsWith('QUIT')) { sock.write('221 bye\r\n'); sock.end(); return; }
      else sock.write('250 OK\r\n');
    }
  });
  sock.on('error', () => {});
}).listen(port, '127.0.0.1', () => console.log('sink SMTP sur ' + port));
