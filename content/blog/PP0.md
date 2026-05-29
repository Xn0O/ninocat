---
title: 游戏设计模式学习笔记
date: 2026-05-28
summary: 中文版：https://gpp.tkchu.me
tags: Blog,GameDev
cover: ./assets/Blog/PP0/0.jpg
hidden: 0
hide_cover: 1
bg_image: ./assets/BG/bg2.jpg
bg_repeat: 
---

# 0. 序

序章写了抽象和解耦虽然可以解决两块代码互相缠绕在一起的情况，并且可以更方便扩展，但代价是过度的抽象可能导致要找到真正起作用的代码需要花费更长的时间，因为这隐藏在了各种抽象的最深处。
而我之前从来不考虑抽象和拓展，等于做完就可以直接丢掉的。但是这种方法不用思考太多东西，只需要疯狂的堆叠if else...if else........就好了，这很适合短时间的gamejam项目（不是）
书中说的这种情况完全就是我：
>*最节约心血的方法是为每段用况编写一段代码。 看看新手程序员，他们经常这么干：为每种情况编写条件逻辑。*
>*但这一点也不优雅，那种风格的代码遇到一点点没想到的输入就会崩溃。 当我们想象优雅的代码时，想的是通用的那一个： 只需要很少的逻辑就可以覆盖整个用况。*
我参加LD59的时候，第一次意识到架构或者规范的好处，我之前一直不敢和别人组队来着，但是规范的开发流程真的很方便协作，互不干扰，我最怕代码冲突了。在LD59的时候我还不小心覆盖了主程老师的代码，不过还好能回退。
![P00](./assets/Blog/PP0/P00.jpg)
->*我第一个独立开发的完整游戏Hya*<-
下面玩就要提到《Hya》，完全由我自己一个人做完的demo，其中的战斗系统就是这样，我直接枚举会出现的情况，根据特例来写代码，没有战斗流程管理，只有一个完全线性的战斗过程，当时的想法是能跑就行。但是这样的话就不能复用了，对每场战斗都要重新单独写一种情况，并且玩家血量不能继承到下一场战斗上。
我的那一坨代码是这样写的，当时还画了一个潦草的流程图，我就不贴上来了。
+>
当敌人血量达到某个值以下就触发二阶段，然后就是攻击阶段>躲避阶段的循环，直到玩家死亡（重新运行当前场景）或者打败敌人（进入下一场景），之前的开发日志的图片：
![P0](./assets/Blog/PP0/P0.jpg)
<+
所以当我想要继续开发这个游戏时，第一个要做的事情就是重构。所以我暂时搁置了。

------
2026.5.28
------
# 1.设计模式


## 1.1命令模式








把行为包成对象，可以保存、替换、传递这个对象。可以实现撤销，排队等功能。
### [1]配置输入
#### (1)硬编码输入
最简单的操作输入就是直接让行为绑定特定按钮（硬编码输入）。
此处用unity里的实现为例。
```C#
void Update()
{
    if (Input.GetKey(KeyCodeDown.X))      Jump();       
    if (Input.GetKey(KeyCodeDown.Y))      FireGun();    
    if (Input.GetKey(KeyCodeDown.A))      SwapWeapon();
    if (Input.GetKey(KeyCodeDown.B))      LurchIneffectively();
}
```
这种实现虽然是最简单的，但是有一个问题，就是这不允许玩家自定义按键配置。为了实现这一功能，我们接下来就要用到命令模式。
#### (2)定义 Command 基类
这样的话可以把执行某个行为（相当于做完了就没了）变成一个对象，这个对象可以被存储、传递、替换等。如果可以替换的话，这不就可以实现玩家自定义按键配置了吗？
```C#
public abstract class Command
{
    public abstract void Execute();
}
```
或者用 C# 的接口：
```C#
public interface ICommand
{
    void Execute();
}
```
*注意，定义接口时，最好以I开头，这样可以更好区分抽象类和接口。*
>比如在其他代码块看到command就能知道这是抽象类，看到Icommand就能知道这是接口。
#### (3)实现具体的子命令
```C#
// 继承 ICommand，实现不同的行为命令
public class JumpCommand : ICommand { public void Execute() => 跳跃(); }
public class FireCommand : ICommand { public void Execute() => 开火(); }
public class SwapCommand : ICommand { public void Execute() => 换武器(); }

```
这里的 == 换武器(); == 是省略了很多内容的，就当这是一个换武器的实现就好了。
 =>换武器();  写法，就是当函数里只有一个语句时，可以省略{}。这是省略{}的语法糖。
比如：
+>
```C#
public int test(int a,int b){
    return a+b;
}
// 等价于
public int test(int a,int b) => a+b;
```
<+
#### (4)自定义按键绑定的实现
OK，到这里，我们定义了几个动作指令，现在应该如何为这些指令绑定不同的按键呢。
1.定义命令，这个我们之前做过了
2.定义按键
定义参数
```C#
    public KeyCode jumpKey = KeyCode.X;
    public KeyCode fireKey = KeyCode.Y;
    private ICommand jumpCommand;
    private ICommand fireCommand;
```
在start里
```C#
    void Start()
    {
        jumpCommand = new JumpCommand();
        fireCommand = new FireCommand();
    }
```
在update里
```C#
    void Update()
    {
        if (Input.GetKey(jumpKey)) jumpCommand.Execute();
        if (Input.GetKey(fireKey)) fireCommand.Execute();
    }
```
玩家通过调用函数来修改键盘映射
```C#
    public void SetJumpKey(KeyCode newKey)  => jumpKey = newKey;
    public void SetFireKey(KeyCode newKey)  => fireKey = newKey;
```
修改行为和修改按键都互不影响。
比如修改jumpKey，并不影响JumpCommand。修改JumpCommand不影响jumpKey。
那么现在我们通过以上方法实现了按键绑定的功能。
书中是通过固定按键槽位来绑定不同事件，我们这里是固定事件（或者说动作）来绑定不同按键。
相当于command作为中间层。
通过 act -> command -> button 实现绑定操作。
代码运行时则是 button -> command -> act来让玩家操作。
#### (5)让命令作用在不同角色身上
我们可以命令定义的时候携带角色的参数。
之前在这里：
```C#
public class JumpCommand : ICommand { public void Execute() => 跳跃(); }//这里硬编码玩家所控制的角色
```
我们并没有说是让谁跳跃，不过这里跳跃当然是控制玩家跳跃啦。这不太好，一点都不通用。

为了让其他角色也能像玩家那样执行命令。

我们的改进方法是把角色参数传进去：
```C#
public interface ICommand
{
    void Execute(GameActor actor);   // 对谁执行
}
```
```C#
public class JumpCommand : ICommand
{
    public void Execute(GameActor actor)
    {
        actor.Jump();                // 谁传进来就让谁跳
    }
}
```
这样的话，同一个跳跃指令，谁传进来就让谁执行跳跃。
之后我们可以设计ai，让ai在不同情况下执行不同的命令即可。
我们可以把这一串的命令叫做命令队列，把这些命令序列化，通过网络传输，到另一端的电脑里重现指令，就可以实现基础的联机功能了。
〉总结一下做了哪些工作，首先是定义了抽象类，再定义子类，在子类写行为。定义类对应的按键名称，最后玩家可以通过把这个按键参数映射在不同的按键上实现按键的更改。
### [2]撤销与重做
#### 1.让命令可以被撤销
这里我们在定义command基类的时候，增加一个undo()
```C#
public interface ICommand
{
    void Execute();
    void Undo();         // 新增
}
```
写一个移动的命令：
必须把移动的参数传进去，用到了构造函数。
```C#
public class MoveUnitCommand : ICommand
{
    // ...省略1
    public MoveUnitCommand(Unit unit, int x, int y)  // 构造函数，必须把参数传进来。
    {
        // ...省略2
    }
    public void Execute() { ... }   // 省略3，重写的方法
    public void Undo() { ... }      // 省略4，重写的方法
}
```
接下来我们把省略补全：
>省略1.定义参数
>省略2.构造函数的初始参数
>省略3.先保存上一步的数据再执行移动命令
>省略4.撤回方法
\注意，我们这里没有定义MoveTo()方法是假设已经有这个方法了。\
省略1:定义参数
```C#
    private Unit unit;
    private int x, y;
    private int xBefore, yBefore;  // 记录移动前的位置，用来撤销
```
省略2:构造函数
```C#
    public MoveUnitCommand(Unit unit, int x, int y)
    {
        // 把参数存起来，方便以后用
        this.unit = unit;
        targetX = x;
        targetY = y;
    }
//为方便理解，把this.unit改成unit，传入的unit改为targetunit也行
//this.unit是成员变量（自己人），unit是传入的参数（外人）
```
省略3:已经有了的移动相关的参数记录下来，外界通过传入新的参数来移动
```C#
    public void Execute()
    {
        xBefore = unit.x;  // 执行前先记下旧位置
        yBefore = unit.y;
        unit.MoveTo(x, y);
    }
```
省略4:撤销，通过记录的上一步信息来回到上一步
```C#
    public void Undo()
    {
        unit.MoveTo(xBefore, yBefore);  // 移回原来的位置
    }
```
具体执行步骤：（例子）
```C#
public class MoveUnitCommand : ICommand
{
    private Unit unit;          // 要移动的单位（构造函数传进来）
    private int targetX;         // 目标 x（构造函数传进来）
    private int targetY;         // 目标 y（构造函数传进来）
    private int beforeX;         // 执行前的位置 x（还没赋值！）
    private int beforeY;         // 执行前的位置 y（还没赋值！）

    public MoveUnitCommand(Unit unit, int x, int y)
    {
        this.unit = unit;
        targetX = x;       // 构造函数存好了目标坐标
        targetY = y;
        // beforeX 和 beforeY 在这里没赋值，默认为 0
    }

    public void Execute()
    {
        beforeX = unit.x;    // ★ 真正执行时才记录"当前的位置"
        beforeY = unit.y;
        unit.MoveTo(targetX, targetY);  // 然后才移动
    }

    public void Undo()
    {
        unit.MoveTo(beforeX, beforeY);  // 用之前记下的位置恢复
    }
}
```
执行：
```C#
var cmd = new MoveUnitCommand(那个单位, 5, 3);
cmd.Execute();
```
| 时间线 | targetX | targetY | beforeX | beforeY |
|------|---------|---------|---------|---------|
| `new MoveUnitCommand(unit, 5, 3)` | 5 | 3 | 0（还未记） | 0（还未记） |
| `Execute()` 刚执行 `beforeX = unit.x` | 5 | 3 | **unit 当前的位置（假设是 2）** | **unit 当前的位置（假设是 2）** |
| `Execute()` 移动完成 | 5 | 3 | 2 | 2 |
| 撤销时 `Undo()` | 5 | 3 | 2 | 2 |

我们每次执行命令的时候都要new一个命令对象出来。如果是c++写的话要注意内存管理，但是c#是有GC的。

#### 2.假如我们要撤销很多步呢？
我们就要用到数据结构的知识来实现了。
可以通过定义一个上一步和下一步的指针来实现。？
但其实不用这么麻烦，可以直接用列表，索引+1就是重做，索引-1就是撤销。
>注意事项
>1.列表的边界处理
>2.撤销后再执行新命令，需要把之后的命令给清除。因为这是一个新的分支了，否则的话，你想想这时候重做会发生什么？（索引+1）两条世界线交叉了不是吗？

要注意的就是，当撤销后又执行新的命令，这时候为了避免出错，我们可以清除当前命令（还没执行新命令时）之后的所有命令。
之后再插入新命令。
举个例子，我的指针始终指向当前指针的下一个位置。
例如当前执行了3个命令（1～3），然后撤回到cmd1再执行cmd4。
![01](./assets/Blog/PP0/01.png)




#### 3.用类还是用函数？
对于撤销和重做，对于有闭包的语言来说，可以省下一些步骤。
闭包就是调用子函数的时候，子函数记住了父函数的字段参数，子函数可以直接拿来用。
类实现：
     定义类 →  写字段 →  写构造函数 →  写 Execute/Undo →  new 出来 →  调用

闭包：
     写一个函数 →  在里面定义 execute 和 undo →  调用
C#闭包语法
```C#
// 格式： 参数 => 表达式
//     (参数) => { 代码 }
```











------
2026.5.29
------