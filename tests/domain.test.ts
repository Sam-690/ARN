import test from 'node:test';
import assert from 'node:assert/strict';
import { D, lineTotal, averageCost, moneySummary } from '../apps/api/src/domain';
import { checkPassword, hashPassword } from '../apps/api/src/security';
test('el dinero usa decimales y redondeo comercial',()=>{assert.equal(lineTotal('3','0.335').toFixed(2),'1.01');assert.equal(D('0.1').add('0.2').toString(),'0.3');});
test('el costo promedio pondera existencia y entrada',()=>{assert.equal(averageCost(10,100,30,120).toString(),'115');assert.equal(averageCost(0,0,3,12.3456).toString(),'12.3456');});
test('separa compromiso, recepción y pago sin doble conteo',()=>{assert.deepEqual(moneySummary({lines:[{quantity:10,received:4,unitPrice:25}],payments:[{amount:30}]}),{total:'250.00',received:'100.00',paid:'30.00',due:'70.00',committed:'150.00'});});
test('los hashes de contraseña tienen sal y verifican sin almacenar el original',()=>{const a=hashPassword('prueba'),b=hashPassword('prueba');assert.notEqual(a,b);assert.ok(checkPassword('prueba',a));assert.equal(checkPassword('incorrecta',a),false);});
