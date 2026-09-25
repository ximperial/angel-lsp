import {expectSuccess} from './utils';

describe('analyzer/moonJavaRegressionPack', () => {
    it('accepts case 1', () => {
        expectSuccess([
            {
                uri: 'file:///path/to/file_base.as',
                content: `
                    class Base {
                        int baseValue;
                    }
                `
            },
            {
                uri: 'file:///path/to/file_mid.as',
                content: `
                    #include "file_base.as"

                    class Mid : Base {
                        int midValue;
                    }
                `
            },
            {
                uri: 'file:///path/to/file_leaf.as',
                content: `
                    #include "file_mid.as"

                    class Leaf : Mid {
                        int total() {
                            return baseValue + midValue;
                        }
                    }

                    int main() {
                        Leaf leaf;
                        return leaf.total();
                    }
                `
            }
        ]);
    });

    it('accepts case 2', () => {
        expectSuccess([
            {
                uri: 'file:///path/to/as.predefined',
                content: `
                    #include "CoreShared.as"
                `
            },
            {
                uri: 'file:///path/to/CoreShared.as',
                content: `
                    namespace TaskSystem {
                        class TaskHandle { }
                        TaskHandle@ RunLater(float delay, TaskCallbackFunc@ callback) { return null; }
                        TaskHandle@ RunEvery(float interval, TaskUpdateFunc@ update) { return null; }
                    }

                    funcdef void TaskCallbackFunc();
                    funcdef bool TaskUpdateFunc();

                    namespace UnitApi {
                        class Unit { void SetTimedLife(float duration, bool removeOnDeath = false) { } }
                        void OnInit() { }
                        void UpdateUnits(float dt) { }
                        Unit@ GetUnitData(unit whichUnit) { return null; }
                    }

                    namespace FrameApi {
                        void InitConsoleUI() { }
                        void UpdateFrame(float dt) { }
                    }

                    class EffectManager {
                        void UpdateEffects(float dt) { }
                    }

                    class LightningManager {
                        void UpdateLightnings(float dt) { }
                    }

                    class MissileManager {
                        void UpdateMissiles(float dt) { }
                    }

                    class unit { }
                    class player { }
                    class GameSystems {
                        EffectManager effectManager;
                        LightningManager lightningManager;
                        MissileManager missileManager;

                        void UpdateManagedSystems(float dt) {
                            UnitApi::UpdateUnits(dt);
                            FrameApi::UpdateFrame(dt);
                            effectManager.UpdateEffects(dt);
                            lightningManager.UpdateLightnings(dt);
                            missileManager.UpdateMissiles(dt);
                        }
                    }

                    bool IsActivePlayerSlot(int playerId) { return playerId >= 0; }
                    bool IsHumanPlayerSlot(int playerId) { return playerId >= 0; }
                    bool IsControllableHuman(player@ playerRef) { return playerRef !is null; }

                    GameSystems game;
                `
            },
            {
                uri: 'file:///path/to/file.as',
                content: `
                    #include "as.predefined"

                    namespace MoonJava {
                        bool UpdateGameTick() {
                            game.UpdateManagedSystems(0.03f);
                            return false;
                        }

                        void InitializeCoreSystems() {
                            FrameApi::InitConsoleUI();
                            UnitApi::OnInit();
                        }

                        void SpawnPlayerHero(unit heroUnit) {
                            UnitApi::Unit@ heroData = UnitApi::GetUnitData(heroUnit);
                            if (heroData !is null) {
                                heroData.SetTimedLife(1.f, true);
                            }
                        }

                        void StartGameTickLoop() {
                            TaskSystem::RunEvery(0.03f, @UpdateGameTick);
                            TaskSystem::RunLater(1.f, @InitializeCoreSystems);
                        }

                        bool HasPlayerControl(int playerId, player playerRef) {
                            return IsActivePlayerSlot(playerId) &&
                                IsHumanPlayerSlot(playerId) &&
                                IsControllableHuman(playerRef);
                        }
                    }
                `
            }
        ]);
    });

    it('accepts case 3', () => {
        expectSuccess([
            {
                uri: 'file:///path/to/as.predefined',
                content: `
                    class unit { }
                    class item { }
                    class ability { }
                    class projectile { }
                    class Unit {
                        float ModifyOutgoingDamage(unit source, unit target, float damage) { return damage; }
                        void OnProjectileLaunch(projectile proj) { }
                        void OnProjectileHit(projectile proj) { }
                        void OnDeath(unit killer, unit dyingUnit) { }
                        void OnDecayFinish(unit decayingUnit) { }
                        void OnAttack(unit attacker, unit target) { }
                        void OnAttackFinish(unit attacker, unit target) { }
                        void OnSpellEffect(unit castingUnit, unit targetUnit, ability spell) { }
                        void OnSpellEffect(unit castingUnit, item targetItem, ability spell) { }
                        void OnSpellEffect(unit castingUnit, ability spell, float targetX, float targetY) { }
                        void OnSpellEffect(unit castingUnit, ability spell) { }
                        void OnAbilityAdded(unit whichUnit, ability whichAbility) { }
                        void OnAbilityRemoved(unit whichUnit, ability whichAbility) { }
                        void OnEnterRegion(unit enteringUnit) { }
                        void OnLeaveRegion(unit leavingUnit) { }
                    }
                `
            },
            {
                uri: 'file:///path/to/file.as',
                content: `
                    class Hero : Unit {
                        Hero() { }
                    }

                    void Dispatch(Unit@ unitData, unit a, unit b, item targetItem, ability spell, projectile proj) {
                        float damage = unitData.ModifyOutgoingDamage(a, b, 50.f);
                        unitData.OnProjectileLaunch(proj);
                        unitData.OnProjectileHit(proj);
                        unitData.OnDeath(a, b);
                        unitData.OnDecayFinish(b);
                        unitData.OnAttack(a, b);
                        unitData.OnAttackFinish(a, b);
                        unitData.OnSpellEffect(a, b, spell);
                        unitData.OnSpellEffect(a, targetItem, spell);
                        unitData.OnSpellEffect(a, spell, 10.f, 20.f);
                        unitData.OnSpellEffect(a, spell);
                        unitData.OnAbilityAdded(a, spell);
                        unitData.OnAbilityRemoved(a, spell);
                        unitData.OnEnterRegion(a);
                        unitData.OnLeaveRegion(b);
                        if (damage > 0.f) { }
                    }
                `
            }
        ]);
    });

    it('accepts case 4', () => {
        expectSuccess([
            {
                uri: 'file:///path/to/as.predefined',
                content: `
                    class code { }
                    class boolexpr { }
                    class handle { }
                    class flagtype : handle { }
                    class targetflag : flagtype { }
                    boolexpr Filter(code func);
                    void HandleListEnumUnitsInRange(int list, float x, float y, float radius, boolexpr filter);
                    void AcceptInt(int value);
                    const targetflag TARGET_FLAG_EMPTY;
                `
            },
            {
                uri: 'file:///path/to/file.as',
                content: `
                    bool BurstDamageInRangeFilter() {
                        return true;
                    }

                    void main() {
                        HandleListEnumUnitsInRange(0, 0.f, 0.f, 100.f, Filter(@BurstDamageInRangeFilter));
                        AcceptInt(TARGET_FLAG_EMPTY);
                    }
                `
            }
        ]);
    });
});
