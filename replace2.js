const fs = require('fs');

function processFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  content = content.replace(/title="Departments"/g, 'title="Specialties"');
  content = content.replace(/description="Configure the clinical departments/g, 'description="Configure the clinical specialties');
  content = content.replace(/>Add Department</g, '>Add Specialty<');
  content = content.replace(/>Department Name</g, '>Specialty Name<');
  content = content.replace(/>Department Code</g, '>Specialty Code<');
  
  fs.writeFileSync(path, content, 'utf8');
}

processFile('apps/web/src/app/dental/organization/_components/departments-panel.tsx');
