import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  const mockAppService = {
    getHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
    getMetrics: jest.fn().mockResolvedValue({ total_requests: 1 }),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  it('should return health status', async () => {
    expect(await appController.getHealth()).toEqual({ status: 'healthy' });
  });

  it('should return metrics', async () => {
    expect(await appController.getMetrics()).toEqual({ total_requests: 1 });
  });

  it('should login successfully', async () => {
    const result = { access_token: 'mock_token' };
    mockAppService.login.mockResolvedValue(result);
    
    const response = await appController.login({ student_id: '123' }, '127.0.0.1');
    expect(response).toBe(result);
  });
});
