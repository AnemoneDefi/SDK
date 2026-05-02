import { Connection } from "@solana/web3.js";

import { CreateMarket } from "./application/use-cases/admin/CreateMarket";
import { InitializeProtocol } from "./application/use-cases/admin/InitializeProtocol";
import {
  PauseProtocol,
  UnpauseProtocol,
} from "./application/use-cases/admin/PauseProtocol";
import { SetKeeper } from "./application/use-cases/admin/SetKeeper";
import { SetRateIndexOracle } from "./application/use-cases/admin/SetRateIndexOracle";

import { DepositToKamino } from "./application/use-cases/keeper/DepositToKamino";
import { SyncKaminoYield } from "./application/use-cases/keeper/SyncKaminoYield";
import { UpdateRateIndex } from "./application/use-cases/keeper/UpdateRateIndex";
import { WithdrawFromKamino } from "./application/use-cases/keeper/WithdrawFromKamino";

import { DepositLiquidity } from "./application/use-cases/lp/DepositLiquidity";
import { RequestWithdrawal } from "./application/use-cases/lp/RequestWithdrawal";

import { AddCollateral } from "./application/use-cases/trader/AddCollateral";
import { ClaimMatured } from "./application/use-cases/trader/ClaimMatured";
import { ClosePositionEarly } from "./application/use-cases/trader/ClosePositionEarly";
import { LiquidatePosition } from "./application/use-cases/trader/LiquidatePosition";
import { OpenSwap } from "./application/use-cases/trader/OpenSwap";
import { SettlePeriod } from "./application/use-cases/trader/SettlePeriod";

import {
  AnchorWallet,
  AnemoneProgram,
  buildAnemoneProgram,
  buildReadonlyProgram,
} from "./infrastructure/anchor/AnemoneProgram";
import { MarketRepository } from "./infrastructure/repositories/MarketRepository";
import { PositionRepository } from "./infrastructure/repositories/PositionRepository";
import { ProtocolRepository } from "./infrastructure/repositories/ProtocolRepository";

export interface AnemoneConfig {
  connection: Connection;
  /** Required to send transactions. Omit for read-only usage. */
  wallet?: AnchorWallet;
}

export class Anemone {
  private readonly program: AnemoneProgram;

  /** Read-only queries: protocol, markets, positions */
  readonly query: AnemoneQuery;

  /** Admin instructions: protocol setup, market creation, pause controls, keeper rotation */
  readonly admin: AnemoneAdmin;

  /** LP instructions: deposit liquidity, request withdrawal */
  readonly lp: AnemoneLp;

  /** Keeper instructions: rate updates, Kamino deposit/withdraw, NAV sync */
  readonly keeper: AnemoneKeeper;

  /** Trader instructions: open/manage/close swap positions */
  readonly trader: AnemoneTrader;

  constructor(config: AnemoneConfig) {
    this.program = config.wallet
      ? buildAnemoneProgram(config.connection, config.wallet)
      : buildReadonlyProgram(config.connection);

    this.query = new AnemoneQuery(this.program);
    this.admin = new AnemoneAdmin(this.program);
    this.lp = new AnemoneLp(this.program);
    this.keeper = new AnemoneKeeper(this.program);
    this.trader = new AnemoneTrader(this.program);
  }
}

class AnemoneQuery {
  readonly protocol: ProtocolRepository;
  readonly markets: MarketRepository;
  readonly positions: PositionRepository;

  constructor(program: AnemoneProgram) {
    this.protocol = new ProtocolRepository(program);
    this.markets = new MarketRepository(program);
    this.positions = new PositionRepository(program);
  }
}

class AnemoneAdmin {
  readonly initializeProtocol: InitializeProtocol;
  readonly createMarket: CreateMarket;
  readonly setKeeper: SetKeeper;
  readonly setRateIndexOracle: SetRateIndexOracle;
  readonly pauseProtocol: PauseProtocol;
  readonly unpauseProtocol: UnpauseProtocol;

  constructor(program: AnemoneProgram) {
    this.initializeProtocol = new InitializeProtocol(program);
    this.createMarket = new CreateMarket(program);
    this.setKeeper = new SetKeeper(program);
    this.setRateIndexOracle = new SetRateIndexOracle(program);
    this.pauseProtocol = new PauseProtocol(program);
    this.unpauseProtocol = new UnpauseProtocol(program);
  }
}

class AnemoneLp {
  readonly depositLiquidity: DepositLiquidity;
  readonly requestWithdrawal: RequestWithdrawal;

  constructor(program: AnemoneProgram) {
    this.depositLiquidity = new DepositLiquidity(program);
    this.requestWithdrawal = new RequestWithdrawal(program);
  }
}

class AnemoneKeeper {
  readonly updateRateIndex: UpdateRateIndex;
  readonly depositToKamino: DepositToKamino;
  readonly withdrawFromKamino: WithdrawFromKamino;
  readonly syncKaminoYield: SyncKaminoYield;

  constructor(program: AnemoneProgram) {
    this.updateRateIndex = new UpdateRateIndex(program);
    this.depositToKamino = new DepositToKamino(program);
    this.withdrawFromKamino = new WithdrawFromKamino(program);
    this.syncKaminoYield = new SyncKaminoYield(program);
  }
}

class AnemoneTrader {
  readonly openSwap: OpenSwap;
  readonly addCollateral: AddCollateral;
  readonly settlePeriod: SettlePeriod;
  readonly closePositionEarly: ClosePositionEarly;
  readonly claimMatured: ClaimMatured;
  readonly liquidatePosition: LiquidatePosition;

  constructor(program: AnemoneProgram) {
    this.openSwap = new OpenSwap(program);
    this.addCollateral = new AddCollateral(program);
    this.settlePeriod = new SettlePeriod(program);
    this.closePositionEarly = new ClosePositionEarly(program);
    this.claimMatured = new ClaimMatured(program);
    this.liquidatePosition = new LiquidatePosition(program);
  }
}
