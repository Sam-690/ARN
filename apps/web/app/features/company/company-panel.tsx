'use client';
import { ArrowRight, Building2, Users } from 'lucide-react';
import { useCan } from '../../access';
import type { Page } from '../../shared/navigation';
import type { Data } from '../../types';

export function CompanyPanel({ data, go }: { data: Data; go: (page: Page) => void }) {
  const can = useCan();
  return (
    <section className="panel experience-form">
      <div className="panel-head">
        <div>
          <h2>
            <Building2 size={20} /> Administración de la empresa
          </h2>
          <p>Sesión de {data.user.name}. Este espacio es independiente de la obra seleccionada.</p>
        </div>
      </div>
      {can('users') ? (
        <div className="detail-box">
          <h3>
            <Users size={20} /> Equipo y permisos
          </h3>
          <p>
            Crea cuentas, administra perfiles, asigna acceso a obras, desactiva usuarios y renueva
            contraseñas desde aquí.
          </p>
          <button className="primary" onClick={() => go('team')}>
            Administrar equipo y permisos <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <p className="small-note">
          La administración de usuarios y permisos está disponible para las cuentas con acceso de
          administración.
        </p>
      )}
    </section>
  );
}
