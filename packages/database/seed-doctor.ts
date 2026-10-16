import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.findFirst()
  if (!org) {
    console.log('No org found')
    return
  }
  
  let user = await prisma.user.findFirst({ where: { organizationId: org.id }})
  if (!user) {
    user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: 'doctor@demo.com',
        firstName: 'Demo',
        lastName: 'Doctor',
        passwordHash: 'dummy',
      }
    })
  }

  // Ensure user has a hospital
  let defaultHospital = await prisma.hospital.findFirst({ where: { organizationId: org.id } })
  if (!defaultHospital) {
     defaultHospital = await prisma.hospital.create({
       data: {
         organizationId: org.id,
         name: 'Demo Hospital',
         code: 'DEMO'
       }
     })
  }

  // Check if doctor exists
  let existingDoctor = await prisma.doctor.findFirst({ where: { userId: user.id } })
  if (!existingDoctor) {
    existingDoctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        hospitalId: defaultHospital.id,
        organizationId: org.id,
        specialization: 'Dentist',
        qualification: 'BDS',
        registrationNumber: 'REG-12345',
        consultationFee: 500,
        joiningDate: new Date(),
        isActive: true,
      }
    })
    console.log(`Created doctor for user ${user.firstName}`)
  } else {
    console.log('Doctor already exists')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
