create database if not exists soviet;
use soviet;

drop table if exists devices;
drop table if exists users;

create table users (
    urid int not null auto_increment,
    urname varchar(64) not null,
    passhash char(60) not null,
    primary key ( urid ),
    unique key ( urname )
) charset = utf8;

create table devices (
    dvid int not null auto_increment,
    urid int null,
    dvname varchar(64) null,
    passhash char(60) not null,
    isOnline tinyint(1) not null default 0,
    sensor float(53) null,
    sensorUpdated datetime null,
    primary key ( dvid ),
    foreign key ( urid )
        references users ( urid )
        on update cascade on delete set null
) charset = utf8;

-- 1234 / 1234
insert into users ( urname, passhash ) values ( "1234", "$2b$10$sqipmMR0DP7eiXL69dm6jOmEo70i9jqEhGZocTeWQrE09bQyiMdg2" );
-- test
insert into devices ( passhash ) values ( "$2b$10$sIlCmS7U7RVsekLWrREKf.pAZE4lkDEUAdZ6PXK7eUrt9nBH2QWte" );
