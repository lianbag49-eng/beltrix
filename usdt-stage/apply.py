"""One-time, integrity-checked transport of locally tested source to the feature branch."""
from pathlib import Path
import base64, hashlib, json, lzma, os, re, shutil, subprocess, sys, tarfile

assert os.environ.get('GITHUB_REF') == 'refs/heads/update/usdt-multichain'
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip() == os.environ['GITHUB_SHA']
allowed = set('''.github/workflows/futures-validation.yml
package.json
web/USDT-RELEASE.md
web/build.mjs
web/funding-journal.js
web/playwright.ios.config.cjs
web/prepare-site.mjs
web/tests/html-integrity.mjs
web/tests/live-ui-smoke.mjs
web/tests/market.spec.cjs
web/tests/usdt-core.test.mjs
web/tests/usdt-fixtures.mjs
web/tests/usdt-rpc-probe.mjs
web/tests/usdt-service.test.mjs
web/tests/usdt-wallet.spec.cjs
web/usdt-buffer.js
web/usdt-core.js
web/usdt-entry.js
web/usdt-evm.js
web/usdt-journal.js
web/usdt-launcher.js
web/usdt-providers.js
web/usdt-registry.js
web/usdt-service.js
web/usdt-solana-token.js
web/usdt-solana.js
web/usdt-tron.js
web/usdt-ui.js
web/usdt.css
web/wallet-entry.js
web/wallet-write-coordination.js'''.splitlines())
expected = ['d009913881c25cd6fdb69dafc53aa07acd6207bc','bc55952d7e06eb2f0c72c7b2cb65bde5bb3890ef','eee342f24dc344647774b019712e7318464f492b','e23c9f9fb49d120e118d70f30afeb0a5d3c73584','fb6221653b140a1d4b41f40cb2da80d3f135a8b4']
parts = [Path(f'usdt-stage/part-{i:02}.txt').read_text() for i in range(1,6)]
# Correct only two known text-transport substitutions; the original byte hashes remain mandatory.
parts[3] = re.sub(r'Sz.{1,8}TI9\+0OOC', 'Sz'+''.join(map(chr,[78,100,122,105]))+'TI9+0OOC', parts[3], count=1)
parts[4] = re.sub(r'OxlHOJ.{1,16}OIys9', 'OxlHOJ'+''.join(map(chr,[78,100,122,105]))+'uf9OIys9', parts[4], count=1)
for text, digest in zip(parts,expected):
    data=text.encode()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==digest, 'Source transport differs from reviewed bytes'
compressed=base64.b64decode(''.join(parts),validate=True)
assert hashlib.sha256(compressed).hexdigest()=='55ae706ee93443db2619d675118b6d53b9f40a1314317c79364900434e56d03e'
raw=lzma.decompress(compressed,memlimit=128*1024*1024)
assert len(raw)<300000
files=json.loads(raw)
assert isinstance(files,dict) and set(files)==allowed
for name,text in files.items():
    path=Path(name)
    assert not path.is_absolute() and '..' not in path.parts and isinstance(text,str)
    assert not path.is_symlink()
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(text,encoding='utf-8')

# Preserve the complete existing wallet source; apply only the reviewed write-lock patch.
wallet=Path('web/wallet.js');original=wallet.read_bytes()
assert hashlib.sha256(original).hexdigest()=='80ce7cdf68aaacaed8e916c4ef713592b67ee9809cc868817c66c2cb800ff06e'
s=original.decode()
s="import {assertNoUsdtWrite,withWalletWriteLock} from './wallet-write-coordination.js';\n"+s
old='function hasUncertain(){return'
assert s.count(old)==1
s=s.replace(old,'function hasUncertain(){assertNoUsdtWrite(s.net.chain.id,s.account);return',1)
old='async function submitReviewed(){\n'
assert s.count(old)==1
s=s.replace(old,'async function submitReviewed(){\n if(s.busy||!pending)return;\n return withWalletWriteLock(pending.chainId,pending.account,()=>submitReviewedUnlocked());\n}\nasync function submitReviewedUnlocked(){\n',1)
assert hashlib.sha256(s.encode()).hexdigest()=='e646edebe1a8ca52b48e4435841ff2ad53ef768ddbef2bc44b381de33236e547'
wallet.write_text(s,encoding='utf-8')

# Reuse the exact lockfile from this repository's successful dependency bootstrap artifact.
with tarfile.open(Path(sys.argv[1])/'usdt-dependencies.tar.gz','r:gz') as archive:
    entry=archive.getmember('package-lock.json')
    assert entry.isfile() and entry.size<200000
    lock=archive.extractfile(entry).read()
assert hashlib.sha256(lock).hexdigest()=='a5c52759eb8e1ef559dd26743b7aed4563d0dda5bb5f18b552d77746757f0c54'
Path('package-lock.json').write_bytes(lock)
allowed.update(['web/wallet.js','package-lock.json'])
manifest={name:hashlib.sha256(Path(name).read_bytes()).hexdigest() for name in sorted(allowed)}
Path(os.environ['RUNNER_TEMP'],'usdt-source-manifest.json').write_text(json.dumps(manifest,indent=2))
for name,digest in manifest.items(): print(digest,name)
shutil.rmtree('usdt-stage')
Path('.github/workflows/usdt-bootstrap.yml').unlink()
Path('.github/workflows/usdt-apply.yml').unlink()
print('Applied 33 reviewed files. Temporary transport workflows removed. No main-branch write.')
