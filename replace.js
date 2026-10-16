const fs = require('fs');

function processFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  // Replace only specific UI strings, careful not to break variable names or API responses
  content = content.replace(/title="Hospitals"/g, 'title="Clinics / Branches"');
  content = content.replace(/description="Manage multiple hospital locations/g, 'description="Manage multiple clinic locations');
  content = content.replace(/>Add Hospital</g, '>Add Clinic<');
  content = content.replace(/Onboard a new hospital/g, 'Onboard a new clinic');
  content = content.replace(/>Hospital Details</g, '>Clinic Details<');
  content = content.replace(/>Hospital Name</g, '>Clinic Name<');
  content = content.replace(/>Hospital Code</g, '>Clinic Code<');
  content = content.replace(/>Departments</g, '>Specialties<');
  content = content.replace(/Add department/g, 'Add specialty');
  content = content.replace(/Remove department/g, 'Remove specialty');
  content = content.replace(/department\(s\)/g, 'specialty(s)');
  
  fs.writeFileSync(path, content, 'utf8');
}

processFile('apps/web/src/app/dental/organization/_components/hospitals-panel.tsx');
processFile('apps/web/src/app/dental/organization/_components/departments-panel.tsx');
