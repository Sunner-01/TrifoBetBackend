import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isAdult', async: false })
export class IsAdultConstraint implements ValidatorConstraintInterface {
  validate(fechaNacimiento: string, args: ValidationArguments) {
    if (!fechaNacimiento) return false;

    // Parse the date (assuming format YYYY-MM-DD or similar standard JS format)
    const dob = new Date(fechaNacimiento);
    if (isNaN(dob.getTime())) return false; // Invalid date format

    const today = new Date();
    
    // Check if the date is in the future
    if (dob > today) {
      return false;
    }

    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age > 100 || dob.getFullYear() < 1920) {
      return false;
    }

    return age >= 18;
  }

  defaultMessage(args: ValidationArguments) {
    const dob = new Date(args.value);
    const today = new Date();
    
    if (dob > today) {
      return 'La fecha de nacimiento no puede ser una fecha futura';
    }
    
    let age = today.getFullYear() - dob.getFullYear();
    if (age > 100 || dob.getFullYear() < 1920) {
      return 'La fecha de nacimiento ingresada no es válida (supera el límite de edad)';
    }
    
    return 'Debes ser mayor de 18 años para registrarte';
  }
}

export function IsAdult(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAdultConstraint,
    });
  };
}
