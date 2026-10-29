import gzip,hashlib,importlib.util,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('publisher',Path(__file__).with_name('publish-release.py'));publisher=importlib.util.module_from_spec(spec);spec.loader.exec_module(publisher)
class DraftIdentity(unittest.TestCase):
 def test_exact_draft(self):
  draft={'tag_name':'v0.3.1','draft':True,'target_commitish':'a'*40};self.assertIs(publisher.validate_release(draft,'0.3.1','a'*40),draft)
 def test_refuse_published_wrong_tag_source_or_input(self):
  base={'tag_name':'v0.3.1','draft':True,'target_commitish':'a'*40}
  for patch in [{'draft':False},{'tag_name':'v0.3.0'},{'target_commitish':'b'*40}]:
   with self.assertRaises(ValueError):publisher.validate_release({**base,**patch},'0.3.1','a'*40)
  for version,source in [('0.3.1;echo bad','a'*40),('0.3.1','main')]:
   with self.assertRaises(ValueError):publisher.validate_release(base,version,source)
 def test_only_exact_successful_cross_platform_ci(self):
  good={'conclusion':'success','head_sha':'a'*40,'name':'Cross-platform bridge checks'}
  self.assertIs(publisher.validate_ci(good,'a'*40),good)
  for patch in [{'conclusion':'cancelled'},{'conclusion':None},{'head_sha':'b'*40},{'name':'Unrelated workflow'}]:
   with self.assertRaises(ValueError):publisher.validate_ci({**good,**patch},'a'*40)
 def test_gzip_normalization_preserves_payload_and_retry_bytes(self):
  with tempfile.TemporaryDirectory() as root:
   first=Path(root)/'first.tar.gz';second=Path(root)/'second.tar.gz';data=b'owned archive fixture'*100
   first.write_bytes(gzip.compress(data,mtime=1));second.write_bytes(gzip.compress(data,mtime=2))
   publisher.normalize_gzip(first);publisher.normalize_gzip(second)
   self.assertEqual(first.read_bytes(),second.read_bytes());self.assertEqual(gzip.decompress(first.read_bytes()),data)
   before=first.read_bytes();publisher.normalize_gzip(first);self.assertEqual(first.read_bytes(),before)
   self.assertEqual(first.with_name(first.name+'.sha256').read_text().split()[0],hashlib.sha256(before).hexdigest())
if __name__=='__main__':unittest.main()
