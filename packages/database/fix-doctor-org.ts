import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const orgId = 'cmup1ybh500003zeem5ci8fxu'
  const userId = 'cmup1ybjr00043zeebmug7gns'
  
  let user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    console.log('User not found!')
    return
  }

  // Ensure user has a hospital in this org
  let defaultHospital = await prisma.hospital.findFirst({ where: { organizationId: orgId } })
  if (!defaultHospital) {
     defaultHospital = await prisma.hospital.create({
       data: {
         organizationId: orgId,
         name: 'Demo Hospital',
         code: 'DEMO'
       }
     })
  }

  // Check if doctor exists for this user in this org
  let existingDoctor = await prisma.doctor.findFirst({ where: { userId: user.id } })
  if (!existingDoctor) {
    existingDoctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        hospitalId: defaultHospital.id,
        organizationId: orgId,
        specialization: 'Dentist',
        qualification: 'BDS',
        registrationNumber: 'REG-12345-2',
        consultationFee: 500,
        joiningDate: new Date(),
        isActive: true,
      }
    })
    console.log(`Created doctor for user ${user.firstName} in active org`)
  } else {
    // If doctor exists but wrong org, fix it
    await prisma.doctor.update({
      where: { id: existingDoctor.id },
      data: { organizationId: orgId, hospitalId: defaultHospital.id }
    })
    console.log('Fixed doctor organization')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
