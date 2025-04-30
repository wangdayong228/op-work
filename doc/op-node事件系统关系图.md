# op-node 事件系统关系图解

## 事件执行器与 Driver 事件循环的关系

```**mermaid**
graph TD
    subgraph "外部世界"
        L1["L1区块链"] --> |新区块头| L1Sig["l1HeadSig 通道<br>Driver.l1HeadSig<br>(op-node/rollup/driver/state.go)"]
        L2["L2区块链"] --> |新区块| L2Sig["unsafeL2Payloads 通道<br>Driver.unsafeL2Payloads"]
    end

    subgraph "事件系统初始化 (op-node/node/node.go: initEventSystem)"
        Init["节点初始化"] --> |创建| Executor["事件执行器 GlobalSyncExec<br>(op-node/rollup/event/executor_global.go)"]
        Init --> |创建| System["事件系统 Sys<br>(op-node/rollup/event/system.go)"]
        Executor --> |依赖| System
        System --> |注册| Node["节点事件处理器<br>OpNode.onEvent"]
    end

    subgraph "Driver 组件 (op-node/rollup/driver/state.go)"
        EventLoop["Driver.eventLoop()"] --> |选择信号| Signals["外部信号处理<br>(select语句)"]

        Signals --> |触发| EmitEvent["发出事件<br>s.Emitter.Emit()"]
****
        EventLoop --> |循环开始| DrainEvents["排空事件队列<br>s.drain()"]

        SyncDeriver["SyncDeriver.OnEvent()<br>(op-node/rollup/driver/state.go)"] --> |处理事件| HandleEvent["处理特定事件<br>(如StepEvent)"]

        HandleEvent --> |可能发出新事件| EmitEvent
    end

    subgraph "事件执行过程"
        EmitEvent --> |调用| SystemEmit["System.emit()<br>(system.go)"]
        SystemEmit --> |入队| EnqueueEvent["Executor.Enqueue()<br>(executor_global.go)"]
        EnqueueEvent --> |添加至| EventQueue["事件队列<br>GlobalSyncExec.events"]

        DrainEvents --> |调用| ExecutorDrain["GlobalSyncExec.Drain()<br>(executor_global.go)"]
        ExecutorDrain --> |遍历处理| EventQueue

        EventQueue --> |执行每个事件| ProcessEvent["GlobalSyncExec.processEvent()<br>(executor_global.go)"]
        ProcessEvent --> |分发到| Derivers["已注册的事件处理器<br>(包括SyncDeriver)"]
        Derivers --> SyncDeriver
    end

    L1Sig --> Signals
    L2Sig --> Signals

    class EventLoop,DrainEvents,EmitEvent,SystemEmit,EnqueueEvent,ExecutorDrain,ProcessEvent,SyncDeriver emphasis
    classDef emphasis fill:#f96,stroke:#333,stroke-width:2px
```

## 关键组件和代码文件

### 初始化相关
- **节点初始化**: `op-node/node/node.go` 中的 `initEventSystem()` 方法
- **事件系统**: `op-node/rollup/event/system.go` 中的 `Sys` 结构体
- **事件执行器**: `op-node/rollup/event/executor_global.go` 中的 `GlobalSyncExec` 结构体

### Driver 相关
- **Driver 定义**: `op-node/rollup/driver/state.go` 中的 `Driver` 结构体
- **事件循环**: `op-node/rollup/driver/state.go` 中的 `eventLoop()` 方法
- **同步派生器**: `op-node/rollup/driver/state.go` 中的 `SyncDeriver` 结构体和 `OnEvent()` 方法

### 事件处理流程
1. **事件发送**:
   - `Emitter.Emit()` → `Sys.emit()` → `Executor.Enqueue()`
   - 代码路径: `发送者` → `op-node/rollup/event/system.go` → `op-node/rollup/event/executor_global.go`

2. **事件处理**:
   - `Driver.eventLoop()` → `drain()` → `GlobalSyncExec.Drain()` → `GlobalSyncExec.processEvent()`
   - 代码路径: `op-node/rollup/driver/state.go` → `op-node/rollup/event/executor_global.go`

## 核心交互流程说明

1. **初始化阶段**:
   ```go
   // op-node/node/node.go
   func (n *OpNode) initEventSystem() {
       executor := event.NewGlobalSynchronous(n.resourcesCtx)
       sys := event.NewSystem(n.log, executor)
       // ...
       n.eventSys = sys
       n.eventDrain = executor  // 保存对执行器的引用，用于后续调用Drain()
   }
   ```

2. **事件发射**:
   ```go
   // 在Driver等组件中
   s.Emitter.Emit(status.L1UnsafeEvent{L1Unsafe: newL1Head})

   // 内部调用路径
   // op-node/rollup/event/system.go
   func (s *Sys) emit(name string, derivContext uint64, ev Event) {
       // ...
       err := s.executor.Enqueue(annotated)
       // ...
   }
   ```

3. **事件处理**:
   ```go
   // op-node/rollup/driver/state.go
   func (s *Driver) eventLoop() {
       // ...
       for {
           // 排空事件队列
           if s.drain != nil {
               if err := s.drain(); err != nil {
                   // 处理错误
               }
           }

           // 选择外部信号
           select {
           case newL1Head := <-s.l1HeadSig:
               s.Emitter.Emit(status.L1UnsafeEvent{L1Unsafe: newL1Head})
               // ...
           }
       }
   }
   ```

4. **事件执行**:
   ```go
   // op-node/rollup/event/executor_global.go
   func (gs *GlobalSyncExec) Drain() error {
       for {
           // ...
           ev := gs.pop()
           // ...
           gs.processEvent(ev)
       }
   }

   func (gs *GlobalSyncExec) processEvent(ev AnnotatedEvent) {
       // ...
       for _, h := range gs.handles {
           h.onEvent(ev)
       }
   }
   ```

## 小结

事件执行器与Driver事件循环之间的关系是一种紧密协作的架构：

- **Driver** 负责响应外部事件(如L1区块更新)并发出系统内部事件
- **事件执行器** 负责管理事件队列并按顺序分发这些事件到各个处理器
- **Driver的eventLoop** 会周期性地通过调用`drain()`(实际上是执行器的`Drain()`方法)来处理所有积累的事件
- 整个系统形成了一个完整的事件循环：外部信号→事件发射→事件入队→事件处理→可能生成新事件