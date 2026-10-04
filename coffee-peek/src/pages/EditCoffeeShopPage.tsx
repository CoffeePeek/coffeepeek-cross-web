import { usePublicResolution } from '../components/PublicAddressPage';
import PublicEntityLink from '../components/PublicEntityLink';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createShopChangeRequest,
  getBrewMethods,
  getCoffeeShopBySlug,
  getEquipments,
  getPhotoUrl,
  getRoasters,
  getShopTags,
  type DetailedCoffeeShop,
  type ShopChangePayloadDto,
  type ShopChangeSection,
  type UploadedPhotoDto,
  type UpdateShopMenuItemRequest,
} from '../api';
import { getMenuDrinks, type CoffeeDrinkDefinitionDto } from '../api/menu';
import { getMenuUploadUrls, getShopUploadUrls, putPhotoToStorage } from '../api/photos';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { getThemeClasses } from '../utils/theme';

const SECTIONS: Array<{ value: ShopChangeSection; label: string }> = [
  { value: 'Description', label: 'Описание' },
  { value: 'Contacts', label: 'Контакты' },
  { value: 'Photos', label: 'Фото кофейни' },
  { value: 'Tags', label: 'Теги' },
  { value: 'Roasters', label: 'Обжарщики' },
  { value: 'Equipment', label: 'Оборудование' },
  { value: 'BrewMethods', label: 'Методы заваривания' },
  { value: 'Menu', label: 'Меню' },
];

type CatalogItem = { id: string; name: string };

async function uploadFiles(
  files: File[],
  getUrls: typeof getShopUploadUrls
): Promise<UploadedPhotoDto[]> {
  if (!files.length) return [];
  const response = await getUrls(files.map((file) => ({
    fileName: file.name,
    contentType: file.type || 'image/jpeg',
    sizeBytes: file.size,
  })));
  return Promise.all(files.map(async (file, index) => {
    const slot = response.data[index];
    if (!slot?.uploadUrl || !slot.storageKey) throw new Error(`Не удалось подготовить ${file.name}`);
    const result = await putPhotoToStorage(slot.uploadUrl, file);
    if (!result.ok) throw new Error(`Не удалось загрузить ${file.name}`);
    return {
      fileName: file.name,
      contentType: file.type || 'image/jpeg',
      storageKey: slot.storageKey,
      size: file.size,
    };
  }));
}

const selectedValues = (event: React.ChangeEvent<HTMLSelectElement>) =>
  Array.from(event.target.selectedOptions, (option) => option.value);

const nullable = (value: string) => value.trim() || null;

const MultiSelect = ({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: CatalogItem[];
  value: string[];
  onChange: (ids: string[]) => void;
}) => (
  <label className="block">
    <span className="block mb-2 text-sm font-semibold">{label}</span>
    <select
      multiple
      value={value}
      onChange={(event) => onChange(selectedValues(event))}
      className="w-full min-h-56 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#2D241F] p-3"
    >
      {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <span className="mt-1 block text-xs opacity-60">Ctrl/Cmd + клик — выбрать несколько</span>
  </label>
);

const EditCoffeeShopPage: React.FC = () => {
  const { shopId: routeId } = useParams<{ shopId: string }>();
  const shopId = usePublicResolution()?.id ?? routeId;
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const tc = getThemeClasses(theme);
  const [shop, setShop] = useState<DetailedCoffeeShop | null>(null);
  const [section, setSection] = useState<ShopChangeSection>('Description');
  const [description, setDescription] = useState('');
  const [contacts, setContacts] = useState({ phoneNumber: '', email: '', siteLink: '', instagramLink: '' });
  const [catalogs, setCatalogs] = useState<Record<'Tags' | 'Roasters' | 'Equipment' | 'BrewMethods', CatalogItem[]>>({
    Tags: [], Roasters: [], Equipment: [], BrewMethods: [],
  });
  const [ids, setIds] = useState<Record<'Tags' | 'Roasters' | 'Equipment' | 'BrewMethods', string[]>>({
    Tags: [], Roasters: [], Equipment: [], BrewMethods: [],
  });
  const [retainedPhotos, setRetainedPhotos] = useState<string[]>([]);
  const [retainedMenuPhotos, setRetainedMenuPhotos] = useState<string[]>([]);
  const [shopFiles, setShopFiles] = useState<File[]>([]);
  const [menuFiles, setMenuFiles] = useState<File[]>([]);
  const [drinks, setDrinks] = useState<CoffeeDrinkDefinitionDto[]>([]);
  const [menuItems, setMenuItems] = useState<UpdateShopMenuItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    let active = true;
    // Переход /shops/A/edit → /shops/B/edit: не показываем и не отправляем форму A, пока грузится B.
    setLoading(true);
    Promise.all([
      getCoffeeShopBySlug(shopId), getShopTags(), getRoasters(), getEquipments(), getBrewMethods(), getMenuDrinks(),
    ]).then(([shopResponse, tags, roasters, equipment, brewMethods, menuDrinks]) => {
      if (!active) return;
      if (!shopResponse.success || !shopResponse.data) throw new Error(shopResponse.message || 'Кофейня не найдена');
      const current = shopResponse.data;
      setShop(current);
      setDescription(current.description ?? '');
      setContacts({
        phoneNumber: current.shopContact?.phone ?? '',
        email: current.shopContact?.email ?? '',
        siteLink: current.shopContact?.website ?? '',
        instagramLink: current.shopContact?.instagram ?? '',
      });
      setCatalogs({
        Tags: tags.data, Roasters: roasters.data, Equipment: equipment.data, BrewMethods: brewMethods.data,
      });
      setIds({
        Tags: current.tags?.map((item) => item.id) ?? [],
        Roasters: current.roasters?.map((item) => item.id) ?? [],
        Equipment: current.equipments?.map((item) => item.id) ?? [],
        BrewMethods: current.brewMethods?.map((item) => item.id) ?? [],
      });
      setRetainedPhotos(current.photos?.flatMap((photo) => photo.id ? [photo.id] : []) ?? []);
      setRetainedMenuPhotos(current.menu?.photos.flatMap((photo) => photo.id ? [photo.id] : []) ?? []);
      setDrinks(menuDrinks.data);
      const existing = new Map(current.menu?.items.map((item) => [item.slug.toLowerCase(), item]));
      setMenuItems(menuDrinks.data.map((drink) => {
        const item = existing.get(drink.slug.toLowerCase());
        return {
          slug: drink.slug,
          availability: item?.availability ?? 'Unknown',
          price: item?.price ?? null,
          volumeMl: item?.volumeMl ?? null,
        };
      }));
    }).catch((error) => showToast(error instanceof Error ? error.message : 'Не удалось загрузить данные', 'error'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [shopId, showToast]);

  const setMenuItem = (slug: string, patch: Partial<UpdateShopMenuItemRequest>) => {
    setMenuItems((items) => items.map((item) => item.slug === slug ? { ...item, ...patch } : item));
  };

  const movePhoto = (kind: 'shop' | 'menu', id: string, direction: -1 | 1) => {
    const current = kind === 'shop' ? retainedPhotos : retainedMenuPhotos;
    const index = current.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    (kind === 'shop' ? setRetainedPhotos : setRetainedMenuPhotos)(next);
  };

  const buildPayload = async (): Promise<ShopChangePayloadDto> => {
    switch (section) {
      case 'Description': return { description: nullable(description) };
      case 'Contacts': return { contacts: {
        phoneNumber: nullable(contacts.phoneNumber), email: nullable(contacts.email),
        siteLink: nullable(contacts.siteLink), instagramLink: nullable(contacts.instagramLink),
      } };
      case 'Tags': return { tags: ids.Tags };
      case 'Roasters': return { roasters: ids.Roasters };
      case 'Equipment': return { equipments: ids.Equipment };
      case 'BrewMethods': return { brewMethods: ids.BrewMethods };
      case 'Photos': return { photos: {
        retainedPhotoIds: retainedPhotos,
        newPhotos: await uploadFiles(shopFiles, getShopUploadUrls),
      } };
      case 'Menu': return { menu: {
        items: menuItems,
        retainedPhotoIds: retainedMenuPhotos,
        newPhotos: await uploadFiles(menuFiles, getMenuUploadUrls),
      } };
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shopId) return;
    setSaving(true);
    try {
      await createShopChangeRequest({ shop: shopId, section, payload: await buildPayload() });
      showToast('Изменения отправлены на модерацию', 'success');
      navigate('/my/edits?status=Pending');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось отправить изменения', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={`min-h-screen ${tc.bg.primary} p-8 ${tc.text.primary}`}>Загрузка…</div>;
  if (!shop) return <div className={`min-h-screen ${tc.bg.primary} p-8 ${tc.text.primary}`}>Кофейня не найдена</div>;

  const inputClass = `w-full rounded-xl border ${tc.border.default} ${tc.bg.card} px-4 py-3 outline-none focus:border-[#D4A84B]`;
  return (
    <main className={`min-h-screen ${tc.bg.primary} ${tc.text.primary} px-4 py-8`}>
      <form onSubmit={submit} className="mx-auto max-w-4xl space-y-6">
        <div>
          <PublicEntityLink kind="shops" entityId={shop.id} className="text-sm text-[#D4A84B]">← {shop.name}</PublicEntityLink>
          <h1 className="mt-2 text-3xl font-bold">Предложить изменения</h1>
          <p className={`mt-2 ${tc.text.secondary}`}>Выберите один раздел. Каждая заявка проверяется отдельно.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((item) => (
            <button key={item.value} type="button" onClick={() => setSection(item.value)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${section === item.value ? 'bg-[#D4A84B] text-white' : `${tc.bg.card} border ${tc.border.default}`}`}>
              {item.label}
            </button>
          ))}
        </div>

        <section className={`${tc.bg.card} border ${tc.border.default} rounded-2xl p-5 sm:p-7 space-y-5`}>
          {section === 'Description' && (
            <label className="block"><span className="mb-2 block font-semibold">Описание</span>
              <textarea maxLength={1000} rows={9} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
              <span className="text-xs opacity-60">{description.length}/1000</span>
            </label>
          )}
          {section === 'Contacts' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>Телефон<input maxLength={20} value={contacts.phoneNumber} onChange={(e) => setContacts({ ...contacts, phoneNumber: e.target.value })} className={`${inputClass} mt-2`} /></label>
              <label>Email<input type="email" maxLength={255} value={contacts.email} onChange={(e) => setContacts({ ...contacts, email: e.target.value })} className={`${inputClass} mt-2`} /></label>
              <label>Сайт<input type="url" maxLength={2048} value={contacts.siteLink} onChange={(e) => setContacts({ ...contacts, siteLink: e.target.value })} className={`${inputClass} mt-2`} /></label>
              <label>Instagram<input maxLength={255} value={contacts.instagramLink} onChange={(e) => setContacts({ ...contacts, instagramLink: e.target.value })} className={`${inputClass} mt-2`} /></label>
            </div>
          )}
          {(section === 'Tags' || section === 'Roasters' || section === 'Equipment' || section === 'BrewMethods') && (
            <MultiSelect label={SECTIONS.find((item) => item.value === section)?.label ?? section}
              items={catalogs[section]} value={ids[section]} onChange={(value) => setIds({ ...ids, [section]: value })} />
          )}
          {section === 'Photos' && (
            <div className="space-y-5">
              <p className="font-semibold">Оставьте отмеченными фотографии, которые нужно сохранить</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {shop.photos?.map((photo) => photo.id && (
                  <label key={photo.id} className="relative cursor-pointer">
                    <img src={getPhotoUrl(photo, 'thumbnail')} alt={photo.fileName} className="aspect-square w-full rounded-xl object-cover" />
                    <input type="checkbox" checked={retainedPhotos.includes(photo.id)} onChange={(e) => setRetainedPhotos(e.target.checked ? [...retainedPhotos, photo.id!] : retainedPhotos.filter((id) => id !== photo.id))} className="absolute left-2 top-2 h-5 w-5" />
                    {retainedPhotos.includes(photo.id) && <span className="absolute bottom-2 right-2 flex gap-1">
                      <button type="button" aria-label="Переместить фото раньше" onClick={(e) => { e.preventDefault(); movePhoto('shop', photo.id!, -1); }} className="rounded bg-black/70 px-2 py-1 text-white">←</button>
                      <button type="button" aria-label="Переместить фото позже" onClick={(e) => { e.preventDefault(); movePhoto('shop', photo.id!, 1); }} className="rounded bg-black/70 px-2 py-1 text-white">→</button>
                    </span>}
                  </label>
                ))}
              </div>
              <label className="block font-semibold">Добавить фотографии
                <input type="file" accept="image/*" multiple onChange={(e) => setShopFiles(Array.from(e.target.files ?? []).slice(0, 12))} className="mt-2 block w-full" />
              </label>
            </div>
          )}
          {section === 'Menu' && (
            <div className="space-y-6">
              <div className="space-y-3">
                {menuItems.map((item) => {
                  const drink = drinks.find((entry) => entry.slug === item.slug);
                  return <div key={item.slug} className={`grid gap-3 rounded-xl border ${tc.border.default} p-3 sm:grid-cols-[1fr_140px_120px_120px] sm:items-center`}>
                    <strong>{drink?.nameRu || item.slug}</strong>
                    <select value={item.availability} onChange={(e) => setMenuItem(item.slug, { availability: e.target.value as UpdateShopMenuItemRequest['availability'] })} className={inputClass}>
                      <option value="Unknown">Неизвестно</option><option value="Present">Есть</option><option value="Absent">Нет</option>
                    </select>
                    <input type="number" min="0" step="0.01" placeholder="Цена" value={item.price ?? ''} onChange={(e) => setMenuItem(item.slug, { price: e.target.value ? Number(e.target.value) : null })} className={inputClass} />
                    <input type="number" min="1" step="1" placeholder="мл" value={item.volumeMl ?? ''} onChange={(e) => setMenuItem(item.slug, { volumeMl: e.target.value ? Number(e.target.value) : null })} className={inputClass} />
                  </div>;
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {shop.menu?.photos.map((photo) => photo.id && (
                  <label key={photo.id} className="relative cursor-pointer">
                    <img src={getPhotoUrl(photo, 'thumbnail')} alt={photo.fileName} className="aspect-square w-full rounded-xl object-cover" />
                    <input type="checkbox" checked={retainedMenuPhotos.includes(photo.id)} onChange={(e) => setRetainedMenuPhotos(e.target.checked ? [...retainedMenuPhotos, photo.id!] : retainedMenuPhotos.filter((id) => id !== photo.id))} className="absolute left-2 top-2 h-5 w-5" />
                    {retainedMenuPhotos.includes(photo.id) && <span className="absolute bottom-2 right-2 flex gap-1">
                      <button type="button" aria-label="Переместить фото меню раньше" onClick={(e) => { e.preventDefault(); movePhoto('menu', photo.id!, -1); }} className="rounded bg-black/70 px-2 py-1 text-white">←</button>
                      <button type="button" aria-label="Переместить фото меню позже" onClick={(e) => { e.preventDefault(); movePhoto('menu', photo.id!, 1); }} className="rounded bg-black/70 px-2 py-1 text-white">→</button>
                    </span>}
                  </label>
                ))}
              </div>
              <label className="block font-semibold">Добавить фото меню
                <input type="file" accept="image/*" multiple onChange={(e) => setMenuFiles(Array.from(e.target.files ?? []).slice(0, 4))} className="mt-2 block w-full" />
              </label>
            </div>
          )}
        </section>

        <button type="submit" disabled={saving} className="rounded-xl bg-[#D4A84B] px-6 py-3 font-bold text-white disabled:opacity-50">
          {saving ? 'Отправляем…' : 'Отправить на модерацию'}
        </button>
      </form>
    </main>
  );
};

export default EditCoffeeShopPage;
