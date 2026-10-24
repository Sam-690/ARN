'use client';
import type { ChangeProposal } from '../../types';
import { Field } from './helpers';
export function ProposalFields({ proposal }: { proposal?: ChangeProposal }) {
  return (
    <>
      <Field label="Alcance propuesto">
        <textarea
          name="scope"
          required
          rows={3}
          maxLength={5000}
          defaultValue={proposal?.scope}
          placeholder="Describe lo que se agrega, modifica o retira"
        />
      </Field>
      <div className="form-grid">
        <Field label="Variación de costo directo (MXN)">
          <input
            name="costDelta"
            type="number"
            step=".01"
            min="-100000000"
            max="100000000"
            required
            defaultValue={proposal?.costDelta || '0'}
          />
        </Field>
        <Field label="Variación del importe al cliente (MXN)">
          <input
            name="priceDelta"
            type="number"
            step=".01"
            min="-100000000"
            max="100000000"
            required
            defaultValue={proposal?.priceDelta || '0'}
          />
        </Field>
        <Field label="Variación del plazo (días naturales)">
          <input
            name="daysDelta"
            type="number"
            min="-3650"
            max="3650"
            step="1"
            required
            defaultValue={proposal?.daysDelta || 0}
          />
        </Field>
      </div>
      <p className="small-note">
        Usa valores positivos para aumentos y negativos para reducciones. El costo ajusta el
        presupuesto directo; el importe al cliente se controla por separado. Importes sin impuestos.
      </p>
    </>
  );
}
