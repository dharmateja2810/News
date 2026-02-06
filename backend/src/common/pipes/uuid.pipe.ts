import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class UuidPipe implements PipeTransform<string, string> {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  transform(value: string): string {
    if (!UuidPipe.UUID_REGEX.test(value)) {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }
    return value;
  }
}
