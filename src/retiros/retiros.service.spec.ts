import { Test, TestingModule } from '@nestjs/testing';
import { RetirosService } from './retiros.service';

describe('RetirosService', () => {
  let service: RetirosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetirosService],
    }).compile();

    service = module.get<RetirosService>(RetirosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
