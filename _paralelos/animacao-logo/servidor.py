"""Serve a animacao.html e transforma os quadros que ela envia num MP4.

    python servidor.py            depois abra http://127.0.0.1:8790/animacao.html
                                  (ou animacao-diamante.html) e clique em "exportar MP4"

Precisa do ffmpeg: o do pacote imageio-ffmpeg (pip install --user imageio-ffmpeg) ou um
ffmpeg no PATH. O vídeo sai em pausa-logo.mp4, nesta pasta: H.264, yuv420p, que abre em
qualquer player, editor, PowerPoint e celular.
"""
import json
import re
import shutil
import subprocess
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI / 'pausa-logo.mp4'
QUADROS = Path(tempfile.mkdtemp(prefix='pausa-quadros-'))


def ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return shutil.which('ffmpeg')


class Pedido(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(AQUI), **kwargs)

    def responder(self, status, corpo):
        dados = json.dumps(corpo).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_POST(self):
        url = urlparse(self.path)
        if url.path.startswith('/quadro/'):
            n = url.path.rsplit('/', 1)[-1]
            if not (n.isdigit() and len(n) == 4):
                return self.responder(400, {'ok': False, 'erro': 'numero de quadro invalido'})
            tamanho = int(self.headers.get('Content-Length', 0))
            (QUADROS / f'{n}.png').write_bytes(self.rfile.read(tamanho))
            return self.responder(200, {'ok': True})
        if url.path == '/fim':
            q = parse_qs(url.query)
            fps = q.get('fps', ['30'])[0]
            nome = q.get('nome', [SAIDA.name])[0]
            if not re.fullmatch(r'[a-z0-9-]+\.mp4', nome) or not fps.isdigit():
                return self.responder(400, {'ok': False, 'erro': 'nome ou fps invalido'})
            saida = AQUI / nome
            exe = ffmpeg()
            if not exe:
                return self.responder(500, {'ok': False, 'erro': 'ffmpeg nao encontrado (pip install --user imageio-ffmpeg)'})
            r = subprocess.run([exe, '-y', '-loglevel', 'error', '-framerate', fps, '-i', str(QUADROS / '%04d.png'),
                                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow',
                                '-movflags', '+faststart', str(saida)], capture_output=True, text=True)
            quadros = sorted(QUADROS.glob('*.png'))
            for q in quadros:
                q.unlink()
            if r.returncode:
                return self.responder(500, {'ok': False, 'erro': r.stderr[-500:]})
            return self.responder(200, {'ok': True, 'arquivo': saida.name, 'quadros': len(quadros), 'bytes': saida.stat().st_size})
        self.responder(404, {'ok': False, 'erro': 'rota desconhecida'})

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print('http://127.0.0.1:8790/animacao.html')
    ThreadingHTTPServer(('127.0.0.1', 8790), Pedido).serve_forever()
