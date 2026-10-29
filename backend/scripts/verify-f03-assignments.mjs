import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { PrismaPg } from '@prisma/adapter-pg';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../dist/generated/prisma/client.js');
const { IdentityService } = require('../dist/src/identity/identity.service.js');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL no configurada');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });
const rollback = new Error('Revertir datos de verificación');
const slug = `verificacion-f03-${randomUUID()}`;

try {
  const users = await prisma.usuario.findMany({
    where: { authUserId: { not: null }, status: 'active' },
    select: {
      id: true,
      authUserId: true,
      fromUsuarioRolUserId: { select: { refRoleId: { select: { code: true } } } },
    },
  });
  const admin = users.find((user) => user.fromUsuarioRolUserId.some((assignment) => assignment.refRoleId.code === 'ADMINISTRADOR'));
  const customer = users.find((user) => user.fromUsuarioRolUserId.length === 1 && user.fromUsuarioRolUserId[0].refRoleId.code === 'CLIENTE');
  assert.ok(admin, 'No hay administrador vinculado a Auth en desarrollo');
  assert.ok(customer?.authUserId, 'No hay un cliente exclusivo vinculado a Auth; entrar a /cuenta con la cuenta de prueba');
  const accessRole = await prisma.rol.findFirstOrThrow({ where: { code: 'ACCESO' }, select: { id: true } });

  try {
    await prisma.$transaction(async (tx) => {
      const identity = new IdentityService({ client: tx });
      const principal = { authUserId: customer.authUserId, userId: customer.id, roles: ['CLIENTE'] };
      const category = await tx.categoria.create({ data: { name: 'Verificación F03', slug } });
      const venue = await tx.ubicacion.create({ data: { name: 'Verificación F03', timezone: 'America/Monterrey' } });
      const event = await tx.evento.create({ data: {
        categoryId: category.id, venueId: venue.id, organizerId: admin.id,
        title: 'Verificación F03', slug,
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 93_600_000),
        timezone: 'America/Monterrey', capacityLimit: 1,
      } });

      assert.equal(await identity.canAccessEvent(principal, event.id), false, 'El cliente accede sin asignación');
      assert.equal(await identity.canAccessEvent(principal, randomUUID()), false, 'El cliente accede a otro evento');

      const assignment = await tx.personalEvento.create({ data: {
        eventId: event.id, userId: customer.id, roleId: accessRole.id,
        status: 'assigned', assignedBy: admin.id,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000),
      } });
      assert.equal(await identity.canAccessEvent(principal, event.id), true, 'La asignación vigente no concede acceso');
      assert.equal((await identity.assignments(principal)).eventAssignments.length, 1);

      await tx.personalEvento.update({ where: { id: assignment.id }, data: { endsAt: new Date(Date.now() - 1_000) } });
      assert.equal(await identity.canAccessEvent(principal, event.id), false, 'La asignación vencida aún concede acceso');

      await tx.personalEvento.update({ where: { id: assignment.id }, data: {
        endsAt: new Date(Date.now() + 60_000), status: 'withdrawn',
      } });
      assert.equal(await identity.canAccessEvent(principal, event.id), false, 'La asignación retirada aún concede acceso');
      throw rollback;
    }, { maxWait: 5_000, timeout: 15_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(await prisma.evento.findUnique({ where: { slug } }), null, 'Los datos de verificación no se revirtieron');
  console.log('F03: cliente sin permiso rechazado; asignación vigente aceptada; vencida y retirada rechazadas. Datos revertidos.');
} finally {
  await prisma.$disconnect();
}
