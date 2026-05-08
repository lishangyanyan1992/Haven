'use client';

import { FormSupplementAnswers } from '@/types/wizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard } from 'lucide-react';

interface PaymentSupplementFormProps {
  value: FormSupplementAnswers;
  onChange: (next: FormSupplementAnswers) => void;
}

function updateField(
  value: FormSupplementAnswers,
  key: keyof FormSupplementAnswers,
  nextValue: string | undefined
): FormSupplementAnswers {
  return {
    ...value,
    [key]: nextValue,
  };
}

export function PaymentSupplementForm({ value, onChange }: PaymentSupplementFormProps) {
  return (
    <div className="rounded-[var(--radius-xl-token)] border border-border bg-white p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-[var(--radius-md-token)] bg-[color:var(--warning-tint)] p-2">
          <CreditCard className="h-5 w-5 text-[color:var(--warning-foreground)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Form G-1450 payment details</h3>
          <p className="text-xs leading-6 text-muted-foreground">
            These credit card fields are required because you selected payment by credit card. They stay only in this
            page state and are not saved to local storage.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label className="mb-2 block text-sm">Cardholder given name</Label>
          <Input
            value={value.payment_cardholder_given_name ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_cardholder_given_name', e.target.value))}
          />
        </div>
        <div>
          <Label className="mb-2 block text-sm">Cardholder middle name</Label>
          <Input
            value={value.payment_cardholder_middle_name ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_cardholder_middle_name', e.target.value))}
          />
        </div>
        <div>
          <Label className="mb-2 block text-sm">Cardholder family name</Label>
          <Input
            value={value.payment_cardholder_family_name ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_cardholder_family_name', e.target.value))}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Label className="mb-2 block text-sm">Billing street address</Label>
          <Input
            value={value.payment_billing_street ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_billing_street', e.target.value))}
          />
        </div>
        <div>
          <Label className="mb-2 block text-sm">Unit type</Label>
          <Select
            value={value.payment_billing_unit_type ?? 'none'}
            onValueChange={(next) =>
              onChange({
                ...value,
                payment_billing_unit_type:
                  next === 'none' ? undefined : (next as FormSupplementAnswers['payment_billing_unit_type']),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="APT">APT</SelectItem>
              <SelectItem value="STE">STE</SelectItem>
              <SelectItem value="FLR">FLR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block text-sm">Unit number</Label>
          <Input
            value={value.payment_billing_unit_number ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_billing_unit_number', e.target.value))}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label className="mb-2 block text-sm">Billing city</Label>
          <Input
            value={value.payment_billing_city ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_billing_city', e.target.value))}
          />
        </div>
        <div>
          <Label className="mb-2 block text-sm">Billing state</Label>
          <Input
            value={value.payment_billing_state ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_billing_state', e.target.value.toUpperCase()))}
            placeholder="TX"
          />
        </div>
        <div>
          <Label className="mb-2 block text-sm">Billing ZIP code</Label>
          <Input
            value={value.payment_billing_zip ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_billing_zip', e.target.value))}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label className="mb-2 block text-sm">Daytime phone number</Label>
          <Input
            value={value.payment_daytime_phone ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_daytime_phone', e.target.value))}
          />
        </div>
        <div className="md:col-span-2">
          <Label className="mb-2 block text-sm">Email address</Label>
          <Input
            value={value.payment_email ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_email', e.target.value))}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <Label className="mb-2 block text-sm">Card type</Label>
          <Select
            value={value.payment_card_type ?? ''}
            onValueChange={(next) =>
              onChange({
                ...value,
                payment_card_type: next as FormSupplementAnswers['payment_card_type'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select card type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Visa">Visa</SelectItem>
              <SelectItem value="MasterCard">MasterCard</SelectItem>
              <SelectItem value="American Express">American Express</SelectItem>
              <SelectItem value="Discover">Discover</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label className="mb-2 block text-sm">Card number</Label>
          <Input
            value={value.payment_card_number ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_card_number', e.target.value))}
            placeholder="1234 1234 1234 1234"
          />
        </div>
        <div>
          <Label className="mb-2 block text-sm">Expiration</Label>
          <Input
            value={value.payment_expiration_date ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_expiration_date', e.target.value))}
            placeholder="MM/YYYY"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label className="mb-2 block text-sm">CVV</Label>
          <Input
            value={value.payment_cvv ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_cvv', e.target.value))}
          />
        </div>
        <div>
          <Label className="mb-2 block text-sm">Authorized amount (USD)</Label>
          <Input
            value={value.payment_authorized_amount ?? ''}
            onChange={(e) => onChange(updateField(value, 'payment_authorized_amount', e.target.value))}
            placeholder="e.g. 3005"
          />
        </div>
      </div>

      <p className="mt-4 text-xs leading-6 text-muted-foreground">
        After download, the credit card holder still must hand-sign Form G-1450 before mailing the packet.
      </p>
    </div>
  );
}
