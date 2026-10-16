import { PrismaClient, SystemRole } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({ where: { type: 'DENTAL' } });
  if (orgs.length === 0) {
    console.log('No DENTAL orgs found.');
    return;
  }
  
  for (const org of orgs) {
    const roles = ['DENTIST', 'DENTAL_ASSISTANT', 'TREATMENT_COORDINATOR', 'LAB_COORDINATOR', 'RECEPTIONIST', 'CASHIER', 'HR', 'INVENTORY_MANAGER'];
    
    for (const sysRole of roles) {
      const existing = await prisma.role.findFirst({ 
        where: { organizationId: org.id, systemRole: sysRole as SystemRole } 
      });
      
      if (!existing) {
        await prisma.role.create({
          data: {
            name: sysRole.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
            description: 'Auto-generated ' + sysRole,
            systemRole: sysRole as SystemRole,
            organizationId: org.id,
          }
        });
        console.log('Created role ' + sysRole + ' for org ' + org.name);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
