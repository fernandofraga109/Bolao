do $$
declare
    r_tabela record;
    r_coluna record;
    v_query text;
    v_create_table text;
    v_insert_statements text;
    v_colunas_lista text;
begin
    -- Cria uma tabela temporária para armazenar o dump final
    create temp table if not exists _meu_dump_projeto (
        ordem serial,
        conteudo text
    ) on commit drop;

    insert into _meu_dump_projeto (conteudo) values ('-- ==========================================');
    insert into _meu_dump_projeto (conteudo) values ('-- DUMP DE ESTRUTURA E DADOS (SUPABASE/POSTGRES)');
    insert into _meu_dump_projeto (conteudo) values ('-- ==========================================\n');

    insert into _meu_dump_projeto (conteudo) values ('-- ------------------------------------------');
    insert into _meu_dump_projeto (conteudo) values ('-- PARTE 1: ESTRUTURA DAS TABELAS (DDL)');
    insert into _meu_dump_projeto (conteudo) values ('-- ------------------------------------------');

    -- 1. LOOP PARA GERAR A ESTRUTURA (CREATE TABLE)
    for r_tabela in 
        select table_name 
        from information_schema.tables 
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
    loop
        v_create_table := 'CREATE TABLE public.' || r_tabela.table_name || ' (\n';
        
        for r_coluna in 
            select column_name, data_type, is_nullable, column_default
            from information_schema.columns
            where table_schema = 'public' 
              and table_name = r_tabela.table_name
            order by ordinal_position
        loop
            v_create_table := v_create_table || '    ' || r_coluna.column_name || ' ' || r_coluna.data_type;
            
            if r_coluna.column_default is not null then
                v_create_table := v_create_table || ' DEFAULT ' || r_coluna.column_default;
            end if;
            
            if r_coluna.is_nullable = 'NO' then
                v_create_table := v_create_table || ' NOT NULL';
            end if;
            
            v_create_table := v_create_table || ',\n';
        end loop;
        
        v_create_table := rtrim(v_create_table, ',\n') || '\n);';
        insert into _meu_dump_projeto (conteudo) values (v_create_table || '\n');
    end loop;

    insert into _meu_dump_projeto (conteudo) values ('\n-- ------------------------------------------');
    insert into _meu_dump_projeto (conteudo) values ('-- PARTE 2: VALORES DAS TABELAS (DML)');
    insert into _meu_dump_projeto (conteudo) values ('-- ------------------------------------------');

    -- 2. LOOP PARA GERAR OS INSERTS CORRIGIDO (to_json)
    for r_tabela in 
        select table_name 
        from information_schema.tables 
        where table_schema = 'public' 
          and table_type = 'BASE TABLE'
    loop
        insert into _meu_dump_projeto (conteudo) values ('-- Dados da tabela: ' || r_tabela.table_name);
        
        select string_agg(column_name, ', ') 
        into v_colunas_lista
        from information_schema.columns
        where table_schema = 'public' and table_name = r_tabela.table_name;

        -- Ajustado de to_jsonb(r) para to_json(r) para casar com json_each_text
        v_query := '
            select string_agg(''INSERT INTO public.' || r_tabela.table_name || ' (' || v_colunas_lista || ') VALUES ('' || t.valores || '');'', chr(10))
            from (
                select (
                    select string_agg(
                        case 
                            when value is null then ''NULL''
                            else '''''''' || replace(value, '''''''', '''''''''''') || ''''''''
                        end, '', '')
                    from json_each_text(to_json(r))
                ) as valores
                from public.' || r_tabela.table_name || ' r
            ) t;';

        begin
            execute v_query into v_insert_statements;
            if v_insert_statements is not null then
                insert into _meu_dump_projeto (conteudo) values (v_insert_statements || '\n');
            else
                insert into _meu_dump_projeto (conteudo) values ('-- (Tabela vazia)\n');
            end if;
        exception when others then
            insert into _meu_dump_projeto (conteudo) values ('-- Erro ao gerar dados para ' || r_tabela.table_name || ': ' || SQLERRM || '\n');
        end;
    end loop;
end $$;

select conteudo from _meu_dump_projeto order by ordem;