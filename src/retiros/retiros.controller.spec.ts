import { Test, TestingModule } from '@nestjs/testing';
import { RetirosController } from './retiros.controller';

describe('RetirosController', () => {
  let controller: RetirosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetirosController],
    }).compile();

    controller = module.get<RetirosController>(RetirosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
